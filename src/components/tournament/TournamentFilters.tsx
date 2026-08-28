"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import {
  BROWSE_STATUSES,
  browseTournamentsHref,
} from "@/lib/tournamentStatus";

const payments: { label: string; value: string }[] = [
  { label: "All", value: "ALL" },
  { label: "Free", value: "FREE" },
  { label: "Paid", value: "PAID" },
  { label: "Sponsored", value: "SPONSORED" },
];

const modes: { label: string; value: string }[] = [
  { label: "All", value: "ALL" },
  { label: "Knockout", value: "MULTIPLAYER" },
  { label: "Battle Royale", value: "BATTLEROYALE" },
  { label: "Groups", value: "GROUPS" },
  { label: "League", value: "LEAGUE" },
];

export function TournamentFilters({
  mode,
  type,
  status,
}: {
  mode: string;
  type: string;
  status: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-4">
      <div className="w-48">
        <Select
          label="Status"
          options={[...BROWSE_STATUSES]}
          value={status}
          onChange={(e) =>
            router.push(browseTournamentsHref(mode, type, e.target.value))
          }
        />
      </div>
      <div className="w-48">
        <Select
          label="Payment"
          options={payments}
          value={mode}
          onChange={(e) =>
            router.push(browseTournamentsHref(e.target.value, type, status))
          }
        />
      </div>
      <div className="w-48">
        <Select
          label="Mode"
          options={modes}
          value={type}
          onChange={(e) =>
            router.push(browseTournamentsHref(mode, e.target.value, status))
          }
        />
      </div>
    </div>
  );
}
