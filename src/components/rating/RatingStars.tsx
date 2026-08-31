export function RatingStars({
  value,
  size = "base",
}: {
  value: number;
  size?: "sm" | "base";
}) {
  const rounded = Math.round(value);
  const cls = size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={`${cls} leading-none`} aria-hidden>
      <span className="text-yellow">{"★".repeat(rounded)}</span>
      <span className="text-white/20">
        {"★".repeat(Math.max(0, 5 - rounded))}
      </span>
    </span>
  );
}
