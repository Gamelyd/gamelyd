"use client";

/**
 * A number field with minus / plus steppers, styled to match the app's inputs.
 * `onChange` receives the clamped numeric value.
 */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  error,
  disabled = false,
  className = "",
}: {
  label?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  const clamp = (n: number) => {
    let v = Number.isFinite(n) ? n : (min ?? 0);
    if (typeof min === "number") v = Math.max(min, v);
    if (typeof max === "number") v = Math.min(max, v);
    return v;
  };

  const atMin = typeof min === "number" && value <= min;
  const atMax = typeof max === "number" && value >= max;

  return (
    <label className="block w-full">
      {label ? (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      ) : null}
      <div
        className={`flex items-stretch overflow-hidden rounded-lg border bg-input transition-colors focus-within:border-primary ${
          error ? "border-lose" : "border-primary/25"
        } ${className}`}
      >
        <button
          type="button"
          aria-label="Decrease"
          disabled={disabled || atMin}
          onClick={() => onChange(clamp(value - step))}
          className="grid w-11 shrink-0 place-items-center text-white/70 transition-colors hover:text-white disabled:opacity-30"
        >
          <Glyph d="M5 12h14" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={String(value)}
          disabled={disabled}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, "");
            onChange(raw === "" ? (min ?? 0) : clamp(Number(raw)));
          }}
          className="w-full min-w-0 border-x border-primary/15 bg-transparent px-2 py-3 text-center text-sm text-white outline-none"
        />
        <button
          type="button"
          aria-label="Increase"
          disabled={disabled || atMax}
          onClick={() => onChange(clamp(value + step))}
          className="grid w-11 shrink-0 place-items-center text-white/70 transition-colors hover:text-white disabled:opacity-30"
        >
          <Glyph d="M12 5v14M5 12h14" />
        </button>
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-lose">{error}</span>
      ) : null}
    </label>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
