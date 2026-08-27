"use client";

import { FALLBACKS, playerIconFor, resolveIcon } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";

export function CatalogAvatar({
  userId,
  icon,
  className,
}: {
  userId: string;
  icon?: string;
  className?: string;
}) {
  const { icons } = useIcons("player");
  const src = resolveIcon(icon, playerIconFor(userId, icons) || FALLBACKS.player);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} />
  );
}
