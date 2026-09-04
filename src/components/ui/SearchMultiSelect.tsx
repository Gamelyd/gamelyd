"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A dark-theme searchable multi-select. Typing only filters the list; the
 * value changes only when an option is picked or a chip removed, so callers do
 * not react to keystrokes.
 */
export function SearchMultiSelect({
  label,
  options,
  selected,
  onChange,
  max = 2,
  placeholder = "Search",
}: {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const atMax = selected.length >= max;
  const q = query.trim().toLowerCase();
  const matches = options
    .filter((o) => !selected.includes(o))
    .filter((o) => (q ? o.toLowerCase().includes(q) : true))
    .slice(0, 30);

  const add = (option: string) => {
    if (selected.includes(option) || selected.length >= max) return;
    onChange([...selected, option]);
    setQuery("");
  };
  const remove = (option: string) =>
    onChange(selected.filter((s) => s !== option));

  return (
    <div className="w-full" ref={root}>
      {label ? (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      ) : null}
      <div className="relative">
        <div
          className={`flex flex-wrap items-center gap-1.5 rounded-lg border bg-input px-2 py-2 transition-colors ${
            open ? "border-primary" : "border-primary/25"
          }`}
        >
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary"
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => remove(s)}
                className="text-primary/70 transition-colors hover:text-white"
              >
                <CloseGlyph />
              </button>
            </span>
          ))}
          {!atMax ? (
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={selected.length === 0 ? placeholder : "Add another"}
              className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-base sm:text-sm text-white outline-none placeholder:text-body/50"
            />
          ) : (
            <span className="px-1 py-0.5 text-xs text-body">
              Up to {max} selected
            </span>
          )}
        </div>

        {open && !atMax && matches.length > 0 ? (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-surface-2 bg-surface py-1 shadow-xl">
            {matches.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => add(o)}
                className="block w-full px-3 py-2 text-left text-sm text-white transition-colors hover:bg-surface-2"
              >
                {o}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
