"use client";

import { useEffect, useState } from "react";
import { catalogToAppIcon, type AppIcon } from "@/lib/icons";
import type { IconKind } from "@/lib/schemas/icon";
import { listIconsAction } from "@/server/actions/iconActions";

export function useIcons(
  kind: IconKind,
  opts?: { gameId?: string; search?: string; taggedOnly?: boolean },
): { icons: AppIcon[]; loading: boolean } {
  const [icons, setIcons] = useState<AppIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const gameId = opts?.gameId ?? "";
  const search = opts?.search ?? "";
  const taggedOnly = Boolean(opts?.taggedOnly);

  useEffect(() => {
    let active = true;
    if (taggedOnly && !gameId) {
      setIcons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void listIconsAction({
      kind,
      gameId: gameId || undefined,
      search: search || undefined,
    }).then((result) => {
      if (!active) return;
      if (result.ok) setIcons(result.data.map(catalogToAppIcon));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kind, gameId, search, taggedOnly]);

  return { icons, loading };
}
