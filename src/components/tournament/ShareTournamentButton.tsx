"use client";

import { ShareButton } from "@/components/ui/ShareButton";

export function ShareTournamentButton({
  name,
  description,
  urlPath,
  className = "",
}: {
  name: string;
  description: string;
  urlPath: string;
  className?: string;
}) {
  return (
    <ShareButton
      name={name}
      description={description}
      urlPath={urlPath}
      className={className}
    />
  );
}
