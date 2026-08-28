import {
  currencySchema,
  type Currency,
} from "@/lib/schemas/common";

export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "USD", label: "USD - US dollar" },
  { value: "NGN", label: "NGN - Nigerian naira" },
  { value: "GBP", label: "GBP - British pound" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GHS", label: "GHS - Ghanaian cedi" },
  { value: "KES", label: "KES - Kenyan shilling" },
  { value: "ZAR", label: "ZAR - South African rand" },
];

export function parseCurrency(value: string | undefined | null): Currency {
  const parsed = currencySchema.safeParse((value ?? "USD").toUpperCase());
  return parsed.success ? parsed.data : "USD";
}

export function formatMoney(
  amount: number,
  currency: string | undefined | null = "USD",
): string {
  const code = parseCurrency(currency);
  const value = amount || 0;
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString()}`;
  }
}
