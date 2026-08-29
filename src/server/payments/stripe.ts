import "server-only";
import Stripe from "stripe";
import { env } from "@/server/env";
import { toMinor } from "./money";
import type { Currency } from "@/lib/schemas/common";

let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(env.stripeSecretKey);
}

function stripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
  }
  if (!client) {
    client = new Stripe(env.stripeSecretKey);
  }
  return client;
}

export async function createStripeCheckout(input: {
  reference: string;
  amount: number;
  currency: Currency;
  email: string;
  title: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ url: string; processorRef: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: input.email || undefined,
    client_reference_id: input.reference,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { ...input.metadata, payment_id: input.reference },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: toMinor(input.amount, input.currency),
          product_data: { name: input.title },
        },
      },
    ],
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, processorRef: session.id };
}

export function constructStripeEvent(
  rawBody: string,
  signature: string,
): Stripe.Event {
  if (!env.stripeWebhookSecret) {
    throw new Error("Stripe webhook secret is not configured");
  }
  return stripe().webhooks.constructEvent(
    rawBody,
    signature,
    env.stripeWebhookSecret,
  );
}

export async function retrieveStripeSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  return stripe().checkout.sessions.retrieve(sessionId);
}

/**
 * Express Connect account for a winner. Stripe collects and verifies the bank
 * details itself on the hosted onboarding flow, so we never touch them.
 */
export async function createStripeConnectAccount(input: {
  email: string;
  country: string;
}): Promise<string> {
  const account = await stripe().accounts.create({
    type: "express",
    email: input.email || undefined,
    country: (input.country || "US").toUpperCase(),
    capabilities: { transfers: { requested: true } },
  });
  return account.id;
}

export async function createStripeAccountLink(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: input.accountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function stripeAccountStatus(accountId: string): Promise<{
  payoutsEnabled: boolean;
  detail: string;
}> {
  const account = await stripe().accounts.retrieve(accountId);
  const due = account.requirements?.currently_due ?? [];
  return {
    payoutsEnabled: Boolean(account.payouts_enabled),
    detail: account.payouts_enabled
      ? ""
      : due.length > 0
        ? `Stripe still needs: ${due.slice(0, 3).join(", ")}`
        : "Stripe is still reviewing this account",
  };
}

export async function stripeTransfer(input: {
  destination: string;
  amount: number;
  currency: Currency;
  reference: string;
  description: string;
}): Promise<{ transferId: string }> {
  const transfer = await stripe().transfers.create(
    {
      amount: toMinor(input.amount, input.currency),
      currency: input.currency.toLowerCase(),
      destination: input.destination,
      description: input.description,
      metadata: { payout_id: input.reference },
    },
    { idempotencyKey: `payout_${input.reference}` },
  );
  return { transferId: transfer.id };
}
