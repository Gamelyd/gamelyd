import type { Payment } from "@/lib/schemas/common";

export function Tag({
  payment,
  className = "",
}: {
  payment: Payment;
  className?: string;
}) {
  return (
    <span
      className={`inline-block bg-pink px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${className}`}
    >
      {payment}
    </span>
  );
}
