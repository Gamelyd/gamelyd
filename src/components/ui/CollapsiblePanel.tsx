"use client";

import { useState, type ReactNode } from "react";

export function CollapsiblePanel({
  title,
  description,
  count,
  defaultOpen = false,
  /**
   * Long lists scroll inside the panel. Forms should not: a nested scroll area
   * around a tall form traps the fields, so pass false for those.
   */
  scroll = true,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  defaultOpen?: boolean;
  scroll?: boolean;
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
        className="flex w-full cursor-pointer items-center justify-between gap-3 bg-surface-2 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">
            {label}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-body">
              {description}
            </span>
          ) : null}
        </span>
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
        <div
          className={
            scroll ? "max-h-80 overflow-y-auto px-4 py-2" : "px-4 py-4"
          }
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
