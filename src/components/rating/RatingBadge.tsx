"use client";

import { useEffect, useState } from "react";
import { RatingStars } from "./RatingStars";
import { ratingSettingsAction } from "@/server/actions/ratingActions";

// One shared fetch of the rating settings for every badge on the page.
let settingsCache: Promise<boolean> | null = null;
function tournamentRatingsOn(): Promise<boolean> {
  if (!settingsCache) {
    settingsCache = ratingSettingsAction().then((r) =>
      r.ok ? r.data.tournament : true,
    );
  }
  return settingsCache;
}

/**
 * Compact rating display for tournament cards and banners. Hides itself when
 * an admin has switched tournament ratings off.
 */
export function RatingBadge({
  average,
  count,
  className = "",
}: {
  average: number;
  count: number;
  className?: string;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void tournamentRatingsOn().then((on) => {
      if (active) setEnabled(on);
    });
    return () => {
      active = false;
    };
  }, []);

  if (enabled === false || !count || count <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <RatingStars value={average} size="sm" />
      <span className="text-xs font-semibold text-white">
        {average.toFixed(1)}
      </span>
      <span className="text-[11px] text-body">({count})</span>
    </span>
  );
}
