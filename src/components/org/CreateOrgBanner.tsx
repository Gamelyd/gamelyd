"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const DISMISS_KEY = "gamelyd_org_banner_dismissed";

export function CreateOrgBanner() {
  const { isAuthenticated, orgs } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const sync = () =>
      setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
    sync();
  }, []);

  if (!isAuthenticated || orgs.length > 0 || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="gradient-brand">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-sm text-white">
          You don&apos;t belong to an organization yet. Create one to host
          tournaments under your brand.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/org/new"
            className="rounded-lg bg-[#04201e] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create organization
          </Link>
          <button
            onClick={dismiss}
            className="px-2 text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
