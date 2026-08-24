"use client";

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const toggle = (option: string) => {
    if (disabled) return;
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }
    onChange([...value, option]);
  };

  return (
    <div>
      <p className="mb-2 text-sm text-label">{label}</p>
      {options.length === 0 ? (
        <p className="text-sm text-body">{hint || "Nothing to select yet"}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => toggle(option.value)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-surface-2 bg-surface text-body hover:border-primary/40"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      {options.length > 0 && hint ? (
        <p className="mt-1.5 text-xs text-body">{hint}</p>
      ) : null}
    </div>
  );
}
