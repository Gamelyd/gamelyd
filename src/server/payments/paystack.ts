import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { toMinor } from "./money";
import type { Currency } from "@/lib/schemas/common";

const PAYSTACK_BASE = "https://api.paystack.co";

export function paystackEnabled(): boolean {
  return Boolean(env.paystackSecretKey);
}

/**
 * Paystack's own error text is far more useful than anything we could invent
 * ("Account number is invalid", "Transfers are not enabled on this account"),
 * so it is preserved and surfaced to the caller rather than swallowed.
 */
export class PaystackError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

interface PaystackEnvelope<T> {
  status?: boolean;
  message?: string;
  data?: T;
  meta?: { next?: string | null };
}

/** Paystack returns HTML on gateway errors, so parsing must never throw. */
function parseBody<T>(raw: string): PaystackEnvelope<T> | null {
  try {
    return JSON.parse(raw) as PaystackEnvelope<T>;
  } catch {
    return null;
  }
}

async function paystackFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!env.paystackSecretKey) {
    throw new PaystackError(
      "Paystack is not configured on this server (PAYSTACK_SECRET_KEY is missing)",
      0,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${PAYSTACK_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.paystackSecretKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new PaystackError("Could not reach Paystack. Try again.", 0);
  }

  // Gateway errors and rate limits come back as HTML, so never assume JSON.
  const raw = await res.text();
  const json = parseBody<T>(raw);

  if (!json) {
    throw new PaystackError(
      res.status === 401
        ? "Paystack rejected our API key"
        : `Paystack returned an unexpected response (HTTP ${res.status})`,
      res.status,
    );
  }
  if (!res.ok || json.status === false) {
    throw new PaystackError(
      json.message || `Paystack request failed (HTTP ${res.status})`,
      res.status,
    );
  }
  return json.data as T;
}

/** Same call, but keeps `meta` so paginated endpoints can follow the cursor. */
async function paystackFetchRaw<T>(
  path: string,
): Promise<{ data: T; meta?: { next?: string | null } }> {
  if (!env.paystackSecretKey) {
    throw new PaystackError(
      "Paystack is not configured on this server (PAYSTACK_SECRET_KEY is missing)",
      0,
    );
  }
  let res: Response;
  try {
    res = await fetch(`${PAYSTACK_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${env.paystackSecretKey}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new PaystackError("Could not reach Paystack. Try again.", 0);
  }
  const raw = await res.text();
  const json = parseBody<T>(raw);
  if (!json) {
    throw new PaystackError(
      res.status === 401
        ? "Paystack rejected our API key"
        : `Paystack returned an unexpected response (HTTP ${res.status})`,
      res.status,
    );
  }
  if (!res.ok || json.status === false) {
    throw new PaystackError(
      json.message || `Paystack request failed (HTTP ${res.status})`,
      res.status,
    );
  }
  return { data: (json.data ?? []) as T, meta: json.meta };
}

export async function initializePaystack(input: {
  reference: string;
  amount: number;
  currency: Currency;
  email: string;
  title: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<{ url: string; processorRef: string }> {
  const data = await paystackFetch<{
    authorization_url: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: toMinor(input.amount, input.currency),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: { ...input.metadata, payment_id: input.reference },
    }),
  });
  return { url: data.authorization_url, processorRef: data.reference };
}

export async function verifyPaystack(
  reference: string,
): Promise<{ paid: boolean; reference: string; amountMinor: number }> {
  const data = await paystackFetch<{
    status: string;
    reference: string;
    amount: number;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    paid: data.status === "success",
    reference: data.reference,
    amountMinor: data.amount,
  };
}

/** Paystack scopes its bank list by country, not currency. */
const PAYSTACK_COUNTRY: Partial<Record<Currency, string>> = {
  NGN: "nigeria",
  GHS: "ghana",
  KES: "kenya",
  ZAR: "south africa",
};

export interface PaystackBank {
  name: string;
  code: string;
}

/**
 * Nigeria alone has well over 200 entries once microfinance banks and fintechs
 * are included, so a single 100-row page silently hides most banks. Page
 * through until Paystack stops returning a cursor.
 */
export async function listPaystackBanks(
  currency: Currency,
): Promise<PaystackBank[]> {
  const country = PAYSTACK_COUNTRY[currency];
  if (!country) {
    throw new PaystackError(`Paystack does not settle ${currency}`, 0);
  }

  const all: PaystackBank[] = [];
  let next: string | null = null;

  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      country,
      currency,
      perPage: "100",
    });
    if (next) params.set("next", next);

    const body = await paystackFetchRaw<{ name: string; code: string }[]>(
      `/bank?${params.toString()}`,
    );
    for (const row of body.data ?? []) {
      if (row?.name && row?.code) all.push({ name: row.name, code: row.code });
    }
    next = body.meta?.next ?? null;
    if (!next) break;
  }

  // Paystack can repeat a code across pages; keep the first name we saw.
  const seen = new Set<string>();
  return all
    .filter((bank) => {
      if (seen.has(bank.code)) return false;
      seen.add(bank.code);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Confirms the account exists and returns the name the bank has on file. */
export async function resolvePaystackAccount(input: {
  accountNumber: string;
  bankCode: string;
}): Promise<{ accountName: string; accountNumber: string }> {
  const params = new URLSearchParams({
    account_number: input.accountNumber,
    bank_code: input.bankCode,
  });
  const data = await paystackFetch<{
    account_number: string;
    account_name: string;
  }>(`/bank/resolve?${params.toString()}`);
  return {
    accountName: data.account_name,
    accountNumber: data.account_number,
  };
}

/**
 * The recipient type is per-country, not universal: sending `nuban` outside
 * Nigeria is rejected by Paystack.
 */
const RECIPIENT_TYPE: Partial<Record<Currency, string>> = {
  NGN: "nuban",
  GHS: "ghipss",
  KES: "mobile_money",
  ZAR: "basa",
};

export async function createPaystackRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
  currency: Currency;
}): Promise<{ recipientCode: string; accountName: string }> {
  const type = RECIPIENT_TYPE[input.currency];
  if (!type) {
    throw new PaystackError(`Paystack does not settle ${input.currency}`, 0);
  }
  const data = await paystackFetch<{
    recipient_code: string;
    details?: { account_name?: string };
  }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type,
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency,
    }),
  });
  return {
    recipientCode: data.recipient_code,
    accountName: data.details?.account_name || input.name,
  };
}

/**
 * Paystack transfers are asynchronous: a `success` status here is provisional
 * until the `transfer.success` / `transfer.failed` webhook lands.
 */
export async function paystackTransfer(input: {
  recipientCode: string;
  amount: number;
  currency: Currency;
  reference: string;
  reason: string;
}): Promise<{ transferCode: string; status: string }> {
  const data = await paystackFetch<{
    transfer_code: string;
    status: string;
  }>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: toMinor(input.amount, input.currency),
      currency: input.currency,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason.slice(0, 100),
    }),
  });
  return { transferCode: data.transfer_code, status: data.status };
}

export function verifyPaystackSignature(rawBody: string, signature: string): boolean {
  if (!env.paystackSecretKey || !signature) return false;
  const hash = createHmac("sha512", env.paystackSecretKey)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
