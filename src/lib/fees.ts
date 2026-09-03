import type { Currency } from "@/lib/schemas/common";

/**
 * Only reaches a charge if paid events are switched back on; today
 * `saveTournament` coerces every event to FREE or SPONSORED, and sponsored
 * prizes are display-only. Kept at the original rate so the constant means what
 * it always meant if that path is ever revived.
 *
 * Locked onto each tournament at create so later rate changes do not rewrite
 * old pots.
 */
export const PLATFORM_FEE_BPS = 1000;

export type Processor = "STRIPE" | "PAYSTACK";

const STRIPE_CURRENCIES = new Set<Currency>(["USD", "GBP", "EUR"]);
const PAYSTACK_CURRENCIES = new Set<Currency>(["NGN", "GHS", "KES", "ZAR"]);

export function processorForCurrency(currency: Currency): Processor {
  if (STRIPE_CURRENCIES.has(currency)) return "STRIPE";
  if (PAYSTACK_CURRENCIES.has(currency)) return "PAYSTACK";
  return "STRIPE";
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function feeFromGross(gross: number, feeBps = PLATFORM_FEE_BPS): number {
  return roundMoney((gross * feeBps) / 10_000);
}

/** Player pays `gross`. Platform keeps the fee; the rest is the prize pot. */
export function splitEntry(gross: number, feeBps = PLATFORM_FEE_BPS): {
  gross: number;
  fee: number;
  net: number;
} {
  const fee = feeFromGross(gross, feeBps);
  return { gross: roundMoney(gross), fee, net: roundMoney(gross - fee) };
}

/**
 * Host advertises `prizes` to winners. They deposit prizes + fee so the board
 * is paid in full.
 */
export function sponsorDeposit(
  prizes: number,
  feeBps = PLATFORM_FEE_BPS,
): { prizes: number; fee: number; gross: number } {
  const prizeTotal = roundMoney(prizes);
  const fee = feeFromGross(prizeTotal, feeBps);
  return { prizes: prizeTotal, fee, gross: roundMoney(prizeTotal + fee) };
}

export function feePercent(feeBps = PLATFORM_FEE_BPS): number {
  return feeBps / 100;
}

export function processorLabel(currency: Currency): string {
  return processorForCurrency(currency) === "STRIPE" ? "Stripe" : "Paystack";
}
