import "server-only";
import { payoutAccounts, payouts } from "@/server/db";
import type { PayoutDoc } from "@/server/documents";
import { ServiceError } from "@/server/services/userService";
import { getPayoutAccountDoc } from "@/server/services/payoutAccountService";
import { createNotification } from "@/server/services/notificationService";
import type {
  PayoutRecord,
  PayoutStatus,
  PayoutTotals,
} from "@/lib/schemas/payment";
import type { Paginated } from "@/lib/result";
import { processorForCurrency } from "@/lib/fees";
import { parseCurrency, formatMoney } from "@/lib/currency";
import { paystackTransfer } from "@/server/payments/paystack";
import { stripeTransfer } from "@/server/payments/stripe";

const PAGE_SIZE = 25;

export function serializePayout(
  doc: PayoutDoc,
  recipientReady = false,
): PayoutRecord {
  return {
    payout_id: doc.payout_id,
    tournamentId: doc.tournamentId,
    tournamentName: doc.tournamentName ?? "",
    place: doc.place,
    teamName: doc.teamName,
    userId: doc.userId ?? "",
    userName: doc.userName ?? "",
    amount: doc.amount,
    currency: parseCurrency(doc.currency),
    status: doc.status,
    note: doc.note ?? "",
    transferRef: doc.transferRef ?? "",
    failureReason: doc.failureReason ?? "",
    paid_at: doc.paid_at ?? "",
    created_at: doc.created_at ?? "",
    recipientReady,
  };
}

/**
 * Marks each row with whether its recipient can be paid right now, so the admin
 * table can grey out rows that would fail. One query for the whole page.
 */
async function withRecipientReadiness(
  docs: PayoutDoc[],
): Promise<PayoutRecord[]> {
  const userIds = [...new Set(docs.map((d) => d.userId).filter(Boolean))];
  const accounts = userIds.length
    ? await (await payoutAccounts())
        .find({ user_id: { $in: userIds }, status: "VERIFIED" })
        .toArray()
    : [];
  const ready = new Set(
    accounts
      .filter((a) => a.recipient_code)
      .map((a) => `${a.user_id}:${a.processor}`),
  );
  return docs.map((doc) =>
    serializePayout(
      doc,
      ready.has(
        `${doc.userId}:${processorForCurrency(parseCurrency(doc.currency))}`,
      ),
    ),
  );
}

export async function listPayoutsAdmin(options: {
  status?: PayoutStatus | "ALL";
  search?: string;
  page?: number;
}): Promise<Paginated<PayoutRecord>> {
  const page = Math.max(options.page ?? 1, 1);
  const filter: Record<string, unknown> = {};
  if (options.status && options.status !== "ALL") {
    filter.status = options.status;
  }
  const search = options.search?.trim();
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { teamName: rx },
      { userName: rx },
      { tournamentName: rx },
      { tournamentId: search },
    ];
  }
  const col = await payouts();
  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();
  return {
    total,
    page,
    last_page: Math.max(Math.ceil(total / PAGE_SIZE), 1),
    items: await withRecipientReadiness(docs),
  };
}

export async function listMyPayouts(userId: string): Promise<PayoutRecord[]> {
  const docs = await (await payouts())
    .find({ userId })
    .sort({ _id: -1 })
    .toArray();
  return docs.map((doc) => serializePayout(doc));
}

export async function payoutTotals(): Promise<PayoutTotals> {
  const col = await payouts();
  const [owed, processing, paid, failed] = await Promise.all([
    col.countDocuments({ status: "OWED" }),
    col.countDocuments({ status: "PROCESSING" }),
    col.countDocuments({ status: "PAID" }),
    col.countDocuments({ status: "FAILED" }),
  ]);
  const pending = await col.find({ status: "OWED" }).toArray();
  const ready = await withRecipientReadiness(pending);
  return {
    owed,
    processing,
    paid,
    failed,
    needsAccount: ready.filter((row) => !row.recipientReady).length,
  };
}

/**
 * Sends one payout. Claims the row first so a double click (or two admins)
 * cannot pay the same winner twice, then hands off to the processor.
 */
export async function disbursePayout(
  payoutId: string,
  adminUid: string,
): Promise<PayoutRecord> {
  const col = await payouts();
  const doc = await col.findOne({ payout_id: payoutId });
  if (!doc) throw new ServiceError("Payout not found");
  if (doc.status === "PAID") throw new ServiceError("This payout is already paid");
  if (doc.status === "PROCESSING") {
    throw new ServiceError("This payout is already being sent");
  }
  if (!doc.userId) {
    throw new ServiceError(
      "This payout has no recipient. The team captain could not be resolved.",
    );
  }
  if (doc.amount <= 0) throw new ServiceError("Nothing to send");

  const currency = parseCurrency(doc.currency);
  const processor = processorForCurrency(currency);
  const account = await getPayoutAccountDoc(doc.userId, processor);
  if (!account || account.status !== "VERIFIED" || !account.recipient_code) {
    throw new ServiceError(
      `${doc.userName || "This recipient"} has not connected a ${processor === "STRIPE" ? "Stripe" : "bank"} payout account yet`,
    );
  }

  const now = new Date().toISOString();
  const claimed = await col.findOneAndUpdate(
    { payout_id: payoutId, status: { $in: ["OWED", "FAILED"] } },
    {
      $set: {
        status: "PROCESSING",
        processor,
        failureReason: "",
        paidBy: adminUid,
        updated_at: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!claimed) throw new ServiceError("This payout is no longer sendable");

  const reason = `${doc.tournamentName || "Tournament"} · ${doc.place > 0 ? `place ${doc.place}` : "host"} · ${doc.teamName}`;

  try {
    if (processor === "PAYSTACK") {
      const transfer = await paystackTransfer({
        recipientCode: account.recipient_code,
        amount: doc.amount,
        currency,
        reference: doc.payout_id,
        reason,
      });
      // Only `success` is terminal here; anything else waits on the webhook.
      const settled = transfer.status === "success";
      return finalize(
        payoutId,
        settled ? "PAID" : "PROCESSING",
        transfer.transferCode,
        "",
      );
    }
    const transfer = await stripeTransfer({
      destination: account.recipient_code,
      amount: doc.amount,
      currency,
      reference: doc.payout_id,
      description: reason,
    });
    return finalize(payoutId, "PAID", transfer.transferId, "");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The transfer was rejected";
    await finalize(payoutId, "FAILED", "", message);
    throw new ServiceError(message);
  }
}

async function finalize(
  payoutId: string,
  status: PayoutStatus,
  transferRef: string,
  failureReason: string,
): Promise<PayoutRecord> {
  const now = new Date().toISOString();
  const col = await payouts();
  const updated = await col.findOneAndUpdate(
    { payout_id: payoutId },
    {
      $set: {
        status,
        transferRef,
        failureReason,
        updated_at: now,
        ...(status === "PAID" ? { paid_at: now } : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Payout not found");
  if (status === "PAID" && updated.userId) {
    void createNotification(
      updated.userId,
      `${formatMoney(updated.amount, updated.currency)} from ${updated.tournamentName || "your tournament"} is on its way to your payout account.`,
      { kind: "GENERIC", tournament_id: updated.tournamentId },
    ).catch(() => undefined);
  }
  return serializePayout(updated);
}

/** Called by the Paystack transfer webhooks, keyed on our payout id. */
export async function resolveTransferOutcome(
  reference: string,
  status: "PAID" | "FAILED",
  failureReason: string,
): Promise<void> {
  const col = await payouts();
  const doc = await col.findOne({ payout_id: reference });
  if (!doc || doc.status === "PAID") return;
  await finalize(reference, status, doc.transferRef, failureReason);
}

/** Records money sent outside the platform (manual bank transfer). */
export async function markPayoutPaidManually(
  payoutId: string,
  adminUid: string,
  reference: string,
): Promise<PayoutRecord> {
  const col = await payouts();
  const doc = await col.findOne({ payout_id: payoutId });
  if (!doc) throw new ServiceError("Payout not found");
  if (doc.status === "PAID") throw new ServiceError("This payout is already paid");
  await col.updateOne(
    { payout_id: payoutId },
    { $set: { paidBy: adminUid, processor: "" } },
  );
  return finalize(payoutId, "PAID", reference || "manual", "");
}
