"use client";

import { useEffect } from "react";
import { useHelp } from "@/context/HelpContext";
import type { HelpTour } from "@/lib/help";

export function PageTour({
  tour,
  enabled = true,
}: {
  tour: HelpTour;
  enabled?: boolean;
}) {
  const { register } = useHelp();
  useEffect(() => {
    if (!enabled) return;
    return register(tour);
  }, [register, tour, enabled]);
  return null;
}
