"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import type { Payment, TournamentMode } from "@/lib/schemas/common";

const payments: { label: string; value: Payment }[] = [
  { label: "Free", value: "FREE" },
  // { label: "Paid", value: "PAID" },
  { label: "Sponsored", value: "SPONSORED" },
];

const modes: { label: string; value: TournamentMode }[] = [
  { label: "Multiplayer", value: "MULTIPLAYER" },
  { label: "Battle Royale", value: "BATTLEROYALE" },
  { label: "Groups", value: "GROUPS" },
  { label: "League", value: "LEAGUE" },
];

export function TournamentFilters({
  mode,
  type,
}: {
  mode: string;
  type: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-4">
      <div className="w-48">
        <Select
          label="Payment"
          options={payments}
          value={mode}
          onChange={(e) =>
            router.push(`/tournament/all/${e.target.value}/${type}`)
          }
        />
      </div>
      <div className="w-48">
        <Select
          label="Mode"
          options={modes}
          value={type}
          onChange={(e) =>
            router.push(`/tournament/all/${mode}/${e.target.value}`)
          }
        />
      </div>
    </div>
  );
}
