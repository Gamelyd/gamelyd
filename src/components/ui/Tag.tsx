import type { Payment } from "@/lib/schemas/common";

const tones: Record<Payment, string> = {
  FREE: "bg-black text-white ring-1 ring-white/30",
  PAID: "bg-primary text-[#04201e]",
  SPONSORED: "bg-yellow text-[#1a1400]",
};

export function Tag({
  payment,
  className = "",
}: {
  payment: Payment;
  className?: string;
}) {
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tones[payment]} ${className}`}
    >
      {payment}
    </span>
  );
}

/** Card edge so posters lift off the page. Sponsored uses yellow so it never blends into the dark bg. */
export function paymentFrame(payment: Payment): string {
  const lift = "shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]";
  if (payment === "SPONSORED") return `${lift} border-2 border-yellow`;
  if (payment === "PAID") return `${lift} border-2 border-primary`;
  return `${lift} border border-white/20`;
}
