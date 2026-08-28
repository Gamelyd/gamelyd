import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { toMinor } from "./money";
import type { Currency } from "@/lib/schemas/common";

const PAYSTACK_BASE = "https://api.paystack.co";

export function paystackEnabled(): boolean {
  return Boolean(env.paystackSecretKey);
}

async function paystackFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!env.paystackSecretKey) {
    throw new Error("Paystack is not configured (PAYSTACK_SECRET_KEY)");
  }
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.paystackSecretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack request failed");
  }
  return json.data;
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
