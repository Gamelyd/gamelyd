"use client";

import { useHelp } from "@/context/HelpContext";
import { helpTarget } from "@/lib/help";

export function HelpButton() {
  const { start } = useHelp();
  return (
    <button
      type="button"
      {...helpTarget("help")}
      onClick={() => start()}
      className="grid h-11 w-11 place-items-center rounded-lg text-white transition-colors hover:bg-white/5 hover:text-primary touch-manipulation"
      aria-label="Show page help"
      title="Help"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.6 9.4c.4-1.4 1.5-2.1 2.6-2.1 1.3 0 2.3.8 2.3 2.1 0 1.2-.7 1.7-1.7 2.3-.9.5-1.2 1-1.2 1.8V14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16.6" r="0.9" fill="currentColor" />
      </svg>
    </button>
  );
}
