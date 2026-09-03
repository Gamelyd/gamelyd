import type { ReactNode } from "react";
import type { Payment } from "@/lib/schemas/common";

/**
 * The one pill used for every badge, chip and label.
 *
 * Tags were previously written inline as `<span>`s with vertical padding. A
 * span is `display: inline` by default, so that padding does not centre the
 * text -- the glyphs sit wherever the line-height puts them, which for the
 * uppercase labels used here reads as noticeably low. `inline-flex` with
 * `leading-none` is what actually centres it, and doing that once here is why
 * this component exists.
 *
 * Add tones rather than passing colour classes in, so the palette stays a
 * closed set and every tag in the product keeps the same shape.
 */

export type TagTone =
  | "primary"
  | "primarySoft"
  | "yellow"
  | "yellowSoft"
  | "cyan"
  | "pink"
  | "win"
  | "lose"
  | "neutral"
  | "outline"
  | "dark";

export type TagSize = "xs" | "sm" | "md";

const tones: Record<TagTone, string> = {
  primary: "bg-primary text-on-primary",
  primarySoft: "bg-primary/15 text-primary",
  yellow: "bg-yellow text-[#1a1400]",
  yellowSoft: "bg-yellow/15 text-yellow",
  cyan: "bg-cyan/15 text-cyan",
  pink: "bg-pink text-white",
  win: "bg-win-deep text-white",
  lose: "bg-lose text-white",
  neutral: "bg-surface-2 text-body",
  outline: "border border-white/20 bg-black/50 text-white",
  dark: "bg-black/70 text-white ring-1 ring-white/20",
};

/**
 * Padding is paired with `leading-none` on the base, so these numbers are the
 * real space above and below the glyphs rather than a guess on top of a
 * line-height.
 */
const sizes: Record<TagSize, string> = {
  xs: "px-2 py-1 text-[10px]",
  sm: "px-2.5 py-1.5 text-[11px]",
  md: "px-3 py-1.5 text-xs",
};

export function Tag({
  children,
  tone = "neutral",
  size = "xs",
  uppercase = true,
  rounded = "full",
  className = "",
}: {
  children: ReactNode;
  tone?: TagTone;
  size?: TagSize;
  uppercase?: boolean;
  /** Square corners suit a poster corner ribbon; everything else is a pill. */
  rounded?: "full" | "md" | "none";
  className?: string;
}) {
  const shape =
    rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded-md" : "";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap font-semibold leading-none ${shape} ${
        uppercase ? "uppercase tracking-wide" : ""
      } ${sizes[size]} ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const paymentTone: Record<Payment, TagTone> = {
  FREE: "dark",
  PAID: "primary",
  SPONSORED: "yellow",
};

export function PaymentTag({
  payment,
  className = "",
}: {
  payment: Payment;
  className?: string;
}) {
  // Free is the norm and needs no badge; a tag is for events that are special.
  if (payment === "FREE") return null;
  return (
    <Tag tone={paymentTone[payment]} size="md" rounded="none" className={className}>
      {payment}
    </Tag>
  );
}

/** Card edge so posters lift off the page. Sponsored uses yellow so it never blends into the dark bg. */
export function paymentFrame(payment: Payment): string {
  const lift = "shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]";
  if (payment === "SPONSORED") return `${lift} border-2 border-yellow`;
  if (payment === "PAID") return `${lift} border-2 border-primary`;
  return `${lift} border border-white/20`;
}
