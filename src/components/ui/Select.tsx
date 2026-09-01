"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  /** Called with an event-like object so `(e) => e.target.value` keeps working. */
  onChange?: (e: { target: { value: string } }) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
}

/**
 * A dark-theme dropdown that replaces the native select, matching the app's
 * inputs. Long lists get a search box. The `onChange` shape mirrors a native
 * change event so existing call sites work unchanged.
 */
export function Select({
  label,
  options,
  value = "",
  onChange,
  error,
  disabled = false,
  className = "",
  placeholder = "Select",
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const opts = options.filter(
    (o, i, all) => all.findIndex((x) => x.value === o.value) === i,
  );
  const current = opts.find((o) => o.value === value);
  const searchable = opts.length > 8;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? opts.filter((o) => o.label.toLowerCase().includes(q))
    : opts;

  const pick = (v: string) => {
    onChange?.({ target: { value: v } });
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="w-full" ref={root}>
      {label ? (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      ) : null}
      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((v) => !v)}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-input px-4 py-3 text-left text-sm outline-none transition-colors ${
            error
              ? "border-lose"
              : open
                ? "border-primary"
                : "border-primary/25"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
            current ? "text-white" : "text-body/60"
          } ${className}`}
        >
          <span className="truncate">
            {current ? current.label : placeholder}
          </span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className={`h-4 w-4 shrink-0 text-white/70 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open ? (
          <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-surface-2 bg-surface shadow-xl">
            {searchable ? (
              <div className="border-b border-surface-2 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-md bg-input px-3 py-2 text-sm text-white outline-none placeholder:text-body/50"
                />
              </div>
            ) : null}
            <div className="max-h-56 overflow-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-4 py-2 text-sm text-body">No matches</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                      o.value === value ? "text-primary" : "text-white"
                    }`}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-lose">{error}</span>
      ) : null}
    </div>
  );
}
