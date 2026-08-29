import "server-only";
import { ObjectId } from "mongodb";
import { payoutAccounts } from "@/server/db";
import type { PayoutAccountDoc } from "@/server/documents";
import { ServiceError, getUserById } from "@/server/services/userService";
import type { Currency } from "@/lib/schemas/common";
import type {
  BankOption,
  ConnectBankAccountInput,
  PayoutAccount,
} from "@/lib/schemas/payment";
import { processorForCurrency, type Processor } from "@/lib/fees";
import { parseCurrency } from "@/lib/currency";
import { env } from "@/server/env";
import {
  createPaystackRecipient,
  listPaystackBanks,
  PaystackError,
  paystackEnabled,
  resolvePaystackAccount,
} from "@/server/payments/paystack";
import {
  createStripeAccountLink,
  createStripeConnectAccount,
  stripeAccountStatus,
  stripeEnabled,
} from "@/server/payments/stripe";

function appUrl(): string {
  return env.appUrl.replace(/\/$/, "");
}

export function serializePayoutAccount(doc: PayoutAccountDoc): PayoutAccount {
  return {
    account_id: doc.account_id,
    user_id: doc.user_id,
    processor: doc.processor,
    status: doc.status,
    bank_name: doc.bank_name ?? "",
    account_last4: doc.account_last4 ?? "",
    account_name: doc.account_name ?? "",
    currency: parseCurrency(doc.currency),
    country: doc.country ?? "",
    detail: doc.detail ?? "",
    created_at: doc.created_at ?? "",
  };
}

export async function getPayoutAccountDoc(
  userId: string,
  processor: Processor,
): Promise<PayoutAccountDoc | null> {
  return (await payoutAccounts()).findOne({ user_id: userId, processor });
}

export async function listMyPayoutAccounts(
  userId: string,
): Promise<PayoutAccount[]> {
  const docs = await (await payoutAccounts())
    .find({ user_id: userId })
    .toArray();
  return docs.map(serializePayoutAccount);
}

/**
 * Whether this user can actually be paid in `currency` today. Stripe accounts
 * are re-checked against the API because onboarding finishes out of band.
 */
export async function canReceivePayout(
  userId: string,
  currency: Currency,
): Promise<boolean> {
  const processor = processorForCurrency(currency);
  const doc = await getPayoutAccountDoc(userId, processor);
  if (!doc) return false;
  if (processor === "PAYSTACK") {
    return doc.status === "VERIFIED" && Boolean(doc.recipient_code);
  }
  if (doc.status === "VERIFIED") return true;
  const refreshed = await refreshStripePayoutAccount(userId).catch(() => null);
  return refreshed?.status === "VERIFIED";
}

export async function listBanksForCurrency(
  currency: Currency,
): Promise<BankOption[]> {
  if (processorForCurrency(currency) !== "PAYSTACK") return [];
  if (!paystackEnabled()) {
    throw new ServiceError(
      "Bank payouts are not set up on this server yet. Contact support.",
    );
  }
  try {
    return await listPaystackBanks(currency);
  } catch (error) {
    throw new ServiceError(
      error instanceof PaystackError
        ? `Could not load the bank list: ${error.message}`
        : "Could not load the bank list. Try again.",
    );
  }
}

/**
 * Resolve the account against the bank, create a Paystack transfer recipient,
 * and keep only the recipient code plus the last four digits.
 */
export async function connectBankAccount(
  userId: string,
  input: ConnectBankAccountInput,
): Promise<PayoutAccount> {
  const currency = parseCurrency(input.currency);
  if (processorForCurrency(currency) !== "PAYSTACK") {
    throw new ServiceError(
      `${currency} payouts are handled by Stripe. Use the Stripe onboarding instead.`,
    );
  }
  if (!paystackEnabled()) {
    throw new ServiceError("Bank payouts are not configured for this currency");
  }

  let resolved: { accountName: string };
  try {
    resolved = await resolvePaystackAccount({
      accountNumber: input.account_number,
      bankCode: input.bank_code,
    });
  } catch (error) {
    // Paystack says exactly what is wrong ("Account number is invalid", "Could
    // not resolve account name"); repeating it beats a generic failure.
    throw new ServiceError(
      error instanceof PaystackError
        ? `Could not verify that account: ${error.message}`
        : "Could not verify that account number with the bank. Check the number and bank, then try again.",
    );
  }

  const banks = await listPaystackBanks(currency).catch(
    () => [] as BankOption[],
  );
  const bankName =
    banks.find((bank) => bank.code === input.bank_code)?.name ?? "";

  let recipient: { recipientCode: string; accountName: string };
  try {
    recipient = await createPaystackRecipient({
      name: resolved.accountName,
      accountNumber: input.account_number,
      bankCode: input.bank_code,
      currency,
    });
  } catch (error) {
    throw new ServiceError(
      error instanceof PaystackError
        ? `Paystack could not save that account: ${error.message}`
        : "Could not save that payout account. Try again.",
    );
  }

  const now = new Date().toISOString();
  const col = await payoutAccounts();
  const existing = await col.findOne({ user_id: userId, processor: "PAYSTACK" });
  const accountId = existing?.account_id ?? new ObjectId().toHexString();

  const doc: PayoutAccountDoc = {
    _id: existing?._id ?? new ObjectId(accountId),
    account_id: accountId,
    user_id: userId,
    processor: "PAYSTACK",
    status: "VERIFIED",
    recipient_code: recipient.recipientCode,
    bank_name: bankName,
    bank_code: input.bank_code,
    account_last4: input.account_number.slice(-4),
    account_name: recipient.accountName,
    currency,
    country: "",
    detail: "",
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await col.replaceOne({ account_id: accountId }, doc, { upsert: true });
  return serializePayoutAccount(doc);
}

/**
 * Stripe collects the bank details on its own hosted flow, so all we store is
 * the connected account id and whether Stripe has enabled payouts on it.
 */
export async function startStripePayoutOnboarding(
  userId: string,
): Promise<{ url: string }> {
  if (!stripeEnabled()) {
    throw new ServiceError("Card payouts (USD/GBP/EUR) are not configured yet");
  }
  const user = await getUserById(userId);
  if (!user) throw new ServiceError("Account not found");

  const col = await payoutAccounts();
  let doc = await col.findOne({ user_id: userId, processor: "STRIPE" });
  const now = new Date().toISOString();

  if (!doc?.recipient_code) {
    const accountId = await createStripeConnectAccount({
      email: user.email,
      country: user.country || "US",
    });
    const ourId = doc?.account_id ?? new ObjectId().toHexString();
    const next: PayoutAccountDoc = {
      _id: doc?._id ?? new ObjectId(ourId),
      account_id: ourId,
      user_id: userId,
      processor: "STRIPE",
      status: "PENDING",
      recipient_code: accountId,
      bank_name: "",
      bank_code: "",
      account_last4: "",
      account_name: `${user.first_name} ${user.last_name}`.trim() || user.user_name,
      currency: "USD",
      country: (user.country || "US").toUpperCase(),
      detail: "Finish Stripe onboarding to receive prize money",
      created_at: doc?.created_at ?? now,
      updated_at: now,
    };
    await col.replaceOne({ account_id: ourId }, next, { upsert: true });
    doc = next;
  }

  const url = await createStripeAccountLink({
    accountId: doc.recipient_code,
    refreshUrl: `${appUrl()}/profile/${userId}?tab=payouts&stripe=refresh`,
    returnUrl: `${appUrl()}/profile/${userId}?tab=payouts&stripe=done`,
  });
  return { url };
}

/** Re-reads Stripe so onboarding completed off-site is reflected here. */
export async function refreshStripePayoutAccount(
  userId: string,
): Promise<PayoutAccount | null> {
  const col = await payoutAccounts();
  const doc = await col.findOne({ user_id: userId, processor: "STRIPE" });
  if (!doc?.recipient_code) return null;

  const status = await stripeAccountStatus(doc.recipient_code);
  const next: Partial<PayoutAccountDoc> = {
    status: status.payoutsEnabled ? "VERIFIED" : "PENDING",
    detail: status.detail,
    updated_at: new Date().toISOString(),
  };
  await col.updateOne({ account_id: doc.account_id }, { $set: next });
  return serializePayoutAccount({ ...doc, ...next } as PayoutAccountDoc);
}

export async function removePayoutAccount(
  userId: string,
  processor: Processor,
): Promise<void> {
  await (await payoutAccounts()).deleteOne({ user_id: userId, processor });
}
