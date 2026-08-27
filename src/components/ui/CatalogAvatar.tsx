"use client";

import { FALLBACKS, playerIconFor } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";

export function CatalogAvatar({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const { icons } = useIcons("player");
  const src = playerIconFor(userId, icons) || FALLBACKS.player;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} />
  );
}
