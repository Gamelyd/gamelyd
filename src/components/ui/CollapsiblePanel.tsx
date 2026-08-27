"use client";

import { useState, type ReactNode } from "react";

export function CollapsiblePanel({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label =
    typeof count === "number" ? `${title} (${count})` : title;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between bg-surface-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white">{label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 shrink-0 text-white/70 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
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
        <div className="max-h-80 overflow-y-auto px-4 py-2">{children}</div>
      ) : null}
    </div>
  );
}
