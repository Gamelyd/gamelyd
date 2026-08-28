import "server-only";
import { ObjectId } from "mongodb";
import { payments, payouts, tournaments } from "@/server/db";
import type { PaymentDoc, PayoutDoc, TournamentDoc } from "@/server/documents";
import { serializeTournament } from "@/server/serialize";
import { asDocFilter, byTournamentId } from "@/server/legacy";
import { ServiceError, getUserById } from "@/server/services/userService";
import { registerForTournament } from "@/server/services/tournamentService";
import {
  playerOnATeam,
  userMayJoinTournament,
} from "@/server/services/inviteService";
import type { Currency } from "@/lib/schemas/common";
import type { RegisterTournamentInput } from "@/lib/schemas/register";
import type { Tournament } from "@/lib/schemas/tournament";
import type { StartEntryCheckoutInput } from "@/lib/schemas/payment";
import {
  PLATFORM_FEE_BPS,
  processorForCurrency,
  roundMoney,
  sponsorDeposit,
  splitEntry,
  type Processor,
} from "@/lib/fees";
import { parseCurrency } from "@/lib/currency";
import { env } from "@/server/env";
import { createStripeCheckout, stripeEnabled } from "@/server/payments/stripe";
import {
  initializePaystack,
  paystackEnabled,
  verifyPaystack,
} from "@/server/payments/paystack";

function appUrl(): string {
  return env.appUrl.replace(/\/$/, "");
}

function processorReady(processor: Processor): boolean {
  return processor === "STRIPE" ? stripeEnabled() : paystackEnabled();
}

async function loadTournament(id: string): Promise<Tournament> {
  const found = await (
    await tournaments()
  ).findOne(asDocFilter<TournamentDoc>(byTournamentId(id)));
  if (!found) throw new ServiceError("Tournament not found");
  return serializeTournament(found);
}

async function userEmail(uid: string): Promise<string> {
  const user = await getUserById(uid);
  if (!user?.email) throw new ServiceError("Your account needs an email to pay");
  return user.email;
}

async function openCheckout(input: {
  paymentId: string;
  amount: number;
  currency: Currency;
  email: string;
  title: string;
  tournamentId: string;
  processor: Processor;
}): Promise<{ url: string; processorRef: string }> {
  if (!processorReady(input.processor)) {
    throw new ServiceError(
      input.processor === "STRIPE"
        ? "Card payments (USD/GBP/EUR) are not configured yet"
        : "Paystack is not configured for this currency",
    );
  }
  if (input.processor === "STRIPE") {
    return createStripeCheckout({
      reference: input.paymentId,
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      title: input.title,
      successUrl: `${appUrl()}/tournament/${input.tournamentId}?checkout=success`,
      cancelUrl: `${appUrl()}/tournament/${input.tournamentId}?checkout=cancel`,
      metadata: { payment_id: input.paymentId },
    });
  }
  return initializePaystack({
    reference: input.paymentId,
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    title: input.title,
    callbackUrl: `${appUrl()}/api/payments/paystack/callback`,
    metadata: {
      payment_id: input.paymentId,
      tournament_id: input.tournamentId,
    },
  });
}

export async function startEntryCheckout(
  uid: string,
  tournamentId: string,
  input: StartEntryCheckoutInput,
): Promise<{ checkoutUrl: string }> {
  const tournament = await loadTournament(tournamentId);
  if (tournament.Payment !== "PAID") {
    throw new ServiceError("This tournament does not charge an entry fee");
  }
  if (tournament.Start) {
    throw new ServiceError("Registration is closed");
  }
  if (!(await userMayJoinTournament(uid, tournament.TournamentId))) {
    throw new ServiceError(
      "This tournament is invite-only. Accept an invite before you pay.",
    );
  }
  if (await playerOnATeam(tournament.TournamentId, uid)) {
    throw new ServiceError("You are already on a team in this event");
  }
  if (
    input.Players.length !== 1 ||
    input.Players[0]?.User_id !== uid
  ) {
    throw new ServiceError(
      "Register yourself first, then invite teammates after you pay.",
    );
  }
  const gross = tournament.RegistrationAmount;
  if (gross <= 0) throw new ServiceError("Entry fee is not set");
  const split = splitEntry(gross, tournament.PlatformFeeBps);
  const currency = parseCurrency(tournament.Currency);
  const processor = processorForCurrency(currency);
  const email = await userEmail(uid);
  const now = new Date().toISOString();
  const paymentId = new ObjectId().toHexString();

  const doc: PaymentDoc = {
    _id: new ObjectId(paymentId),
    payment_id: paymentId,
    kind: "ENTRY",
    status: "PENDING",
    processor,
    currency,
    tournamentId: tournament.TournamentId,
    userId: uid,
    amount: split.gross,
    fee: split.fee,
    net: split.net,
    feeBps: tournament.PlatformFeeBps || PLATFORM_FEE_BPS,
    processorRef: paymentId,
    checkoutUrl: "",
    email,
    registration: {
      Players: input.Players,
      TeamName: input.TeamName,
      Icon: input.Icon,
    },
    created_at: now,
    updated_at: now,
    paid_at: "",
  };
  await (await payments()).insertOne(doc);

  const checkout = await openCheckout({
    paymentId,
    amount: split.gross,
    currency,
    email,
    title: `Entry · ${tournament.Name}`,
    tournamentId: tournament.TournamentId,
    processor,
  });
  await (await payments()).updateOne(
    { payment_id: paymentId },
    {
      $set: {
        processorRef: checkout.processorRef,
        checkoutUrl: checkout.url,
        updated_at: new Date().toISOString(),
      },
    },
  );
  return { checkoutUrl: checkout.url };
}

export async function startSponsorCheckout(
  uid: string,
  tournamentId: string,
): Promise<{ checkoutUrl: string }> {
  const tournament = await loadTournament(tournamentId);
  if (tournament.Payment !== "SPONSORED") {
    throw new ServiceError("This tournament is not sponsored");
  }
  if (tournament.PurseFunded) {
    throw new ServiceError("Prize pool is already funded");
  }
  if (tournament.User_id !== uid) {
    throw new ServiceError("Only the host can fund this prize pool");
  }
  const prizes = tournament.Prizes.reduce((sum, row) => sum + (row.Amount || 0), 0);
  if (prizes <= 0) throw new ServiceError("Set prize amounts first");
  const deposit = sponsorDeposit(prizes, tournament.PlatformFeeBps);
  const currency = parseCurrency(tournament.Currency);
  const processor = processorForCurrency(currency);
  const email = await userEmail(uid);
  const now = new Date().toISOString();
  const paymentId = new ObjectId().toHexString();

  await (await payments()).insertOne({
    _id: new ObjectId(paymentId),
    payment_id: paymentId,
    kind: "SPONSOR_FUND",
    status: "PENDING",
    processor,
    currency,
    tournamentId: tournament.TournamentId,
    userId: uid,
    amount: deposit.gross,
    fee: deposit.fee,
    net: deposit.prizes,
    feeBps: tournament.PlatformFeeBps || PLATFORM_FEE_BPS,
    processorRef: paymentId,
    checkoutUrl: "",
    email,
    created_at: now,
    updated_at: now,
    paid_at: "",
  });

  const checkout = await openCheckout({
    paymentId,
    amount: deposit.gross,
    currency,
    email,
    title: `Prize pool · ${tournament.Name}`,
    tournamentId: tournament.TournamentId,
    processor,
  });
  await (await payments()).updateOne(
    { payment_id: paymentId },
    {
      $set: {
        processorRef: checkout.processorRef,
        checkoutUrl: checkout.url,
        updated_at: new Date().toISOString(),
      },
    },
  );
  return { checkoutUrl: checkout.url };
}

export async function fulfillPayment(paymentId: string): Promise<void> {
  const col = await payments();
  const doc = await col.findOne({ payment_id: paymentId });
  if (!doc) throw new ServiceError("Payment not found");
  if (doc.status === "PAID") return;
  if (doc.status !== "PENDING") {
    throw new ServiceError("Payment cannot be completed");
  }

  const paidAt = new Date().toISOString();
  const claimed = await col.findOneAndUpdate(
    { payment_id: paymentId, status: "PENDING" },
    { $set: { status: "PAID", paid_at: paidAt, updated_at: paidAt } },
    { returnDocument: "after" },
  );
  if (!claimed) return;

  const tCol = await tournaments();
  if (claimed.kind === "SPONSOR_FUND") {
    await tCol.updateOne(asDocFilter<TournamentDoc>(byTournamentId(claimed.tournamentId)), {
      $set: {
        PurseFunded: true,
        PotNet: claimed.net,
        FeeCollected: claimed.fee,
        Amount: claimed.net,
        Updated_at: paidAt,
      },
    });
    return;
  }

  if (claimed.kind === "ENTRY" && claimed.registration) {
    try {
      await registerForTournament(
        claimed.tournamentId,
        {
          Players: claimed.registration.Players,
          TeamName: claimed.registration.TeamName,
          Icon: claimed.registration.Icon,
          RefNumber: claimed.payment_id,
          PaymentChannel: claimed.processor,
          Amount: claimed.amount,
        },
        { paidPaymentId: claimed.payment_id, actorUid: claimed.userId, captainOnly: true, allowPartialRoster: true },
      );
      await tCol.updateOne(
        asDocFilter<TournamentDoc>(byTournamentId(claimed.tournamentId)),
        {
          $inc: { PotNet: claimed.net, FeeCollected: claimed.fee },
          $set: { Updated_at: paidAt },
        },
      );
    } catch (error) {
      await col.updateOne(
        { payment_id: paymentId },
        {
          $set: {
            status: "FAILED",
            updated_at: new Date().toISOString(),
          },
        },
      );
      throw error;
    }
  }
}

export async function fulfillByProcessorRef(ref: string): Promise<void> {
  const doc =
    (await (await payments()).findOne({ processorRef: ref })) ??
    (await (await payments()).findOne({ payment_id: ref }));
  if (!doc) throw new ServiceError("Payment not found");
  if (doc.processor === "PAYSTACK") {
    const verified = await verifyPaystack(doc.processorRef || doc.payment_id);
    if (!verified.paid) throw new ServiceError("Payment not complete");
  }
  await fulfillPayment(doc.payment_id);
}

export async function listTournamentPayouts(
  tournamentId: string,
): Promise<PayoutDoc[]> {
  return (await payouts())
    .find({ tournamentId })
    .sort({ place: 1 })
    .toArray();
}

export async function settleEndedTournament(tournamentId: string): Promise<void> {
  const tournament = await loadTournament(tournamentId);
  if (tournament.Payment === "FREE") return;
  if (tournament.SettlementStatus === "SETTLED" || tournament.SettlementStatus === "OPEN") {
    return;
  }
  if (!tournament.Winner?.TeamName?.trim()) return;

  const currency = parseCurrency(tournament.Currency);
  const champ = tournament.Winner.TeamName.trim();
  const lines: { place: number; teamName: string; amount: number; note: string }[] =
    [];

  if (tournament.Payment === "SPONSORED") {
    const first = tournament.Prizes.find((p) => p.Position === 1);
    const rest = tournament.Prizes.filter((p) => p.Position !== 1);
    if (first && first.Amount > 0) {
      lines.push({
        place: 1,
        teamName: champ,
        amount: roundMoney(first.Amount),
        note: "1st place",
      });
    }
    const leftover = rest.reduce((sum, row) => sum + (row.Amount || 0), 0);
    if (leftover > 0) {
      lines.push({
        place: 0,
        teamName: "Host",
        amount: roundMoney(leftover),
        note: "Unassigned places returned to host until standings are paid out",
      });
    }
  } else {
    const pot = tournament.PotNet;
    const shares = tournament.Prizes.filter((p) => (p.Share || 0) > 0);
    const shareTotal = shares.reduce((sum, row) => sum + row.Share, 0) || 100;
    const firstShare =
      shares.find((p) => p.Position === 1)?.Share ??
      (shareTotal > 0 ? shareTotal : 100);
    const firstAmount = roundMoney((pot * firstShare) / shareTotal);
    lines.push({
      place: 1,
      teamName: champ,
      amount: firstAmount,
      note: "Champion share of net pot",
    });
    const remainder = roundMoney(pot - firstAmount);
    if (remainder > 0) {
      lines.push({
        place: 0,
        teamName: "Host",
        amount: remainder,
        note: "Remaining net pot (other places unpaid until assigned)",
      });
    }
  }

  const now = new Date().toISOString();
  const col = await payouts();
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const payoutId = new ObjectId().toHexString();
    await col.insertOne({
      _id: new ObjectId(payoutId),
      payout_id: payoutId,
      tournamentId: tournament.TournamentId,
      place: line.place,
      teamName: line.teamName,
      amount: line.amount,
      currency,
      status: "OWED",
      note: line.note,
      created_at: now,
      updated_at: now,
    });
  }
  await (await tournaments()).updateOne(
    asDocFilter<TournamentDoc>(byTournamentId(tournament.TournamentId)),
    {
      $set: {
        SettlementStatus: "OPEN",
        Updated_at: now,
      },
    },
  );
}
