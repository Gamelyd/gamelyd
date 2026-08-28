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
