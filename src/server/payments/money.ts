import "server-only";
import type { Currency } from "@/lib/schemas/common";

/** All supported currencies use two decimal places. */
export function toMinor(amount: number, _currency: Currency): number {
  return Math.round(amount * 100);
}

export function fromMinor(amount: number, _currency: Currency): number {
  return Math.round(amount) / 100;
}
