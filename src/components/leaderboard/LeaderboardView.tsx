"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Select";
import { SearchMultiSelect } from "@/components/ui/SearchMultiSelect";
import { Loader } from "@/components/ui/Loader";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { leaderboardAction } from "@/server/actions/leaderboardActions";
import type { LeaderRow } from "@/server/services/leaderboardService";

const PAYMENTS = [
  { value: "ALL", label: "All events" },
  { value: "FREE", label: "Free" },
  { value: "SPONSORED", label: "Sponsored" },
];

const METRICS = [
  { value: "won", label: "Tournaments won" },
  { value: "matchesWon", label: "Matches won" },
  { value: "matchesPlayed", label: "Matches played" },
];

const VALUE_LABEL: Record<string, string> = {
  won: "Titles",
  matchesWon: "Wins",
  matchesPlayed: "Played",
};

export function LeaderboardView({ games }: { games: { name: string }[] }) {
  const [payment, setPayment] = useState("ALL");
  const [metric, setMetric] = useState("won");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void leaderboardAction({ payment, metric, games: selectedGames }).then(
      (result) => {
        if (!active) return;
        setRows(result.ok ? result.data : []);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [payment, metric, selectedGames]);

  const gameNames = games
    .map((g) => g.name)
    .filter((n, i, all) => n && all.indexOf(n) === i);
  const valueLabel = VALUE_LABEL[metric] ?? "Wins";
  const list = rows ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Select
            label="Ranking"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            options={METRICS}
          />
        </div>
        <div className="w-40">
          <Select
            label="Events"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            options={PAYMENTS}
          />
        </div>
        <div className="w-64">
          <SearchMultiSelect
            label="Games (up to 2)"
            options={gameNames}
            selected={selectedGames}
            onChange={setSelectedGames}
            max={2}
            placeholder="Search games (all)"
          />
        </div>
      </div>

      {loading && rows === null ? (
        <Loader label="Loading the leaderboard" />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface py-16 text-center text-body">
          No results yet for these filters.
        </div>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-surface-2">
          {list.map((row, i) => (
            <li
              key={row.name}
              className={`flex items-center gap-4 px-4 py-3 ${
                i % 2 ? "bg-surface" : "bg-surface-2/30"
              } ${i < 3 ? "border-l-2 border-primary" : ""}`}
            >
              <span
                className={`w-7 shrink-0 text-center font-display text-lg ${
                  i < 3 ? "text-primary" : "text-body"
                }`}
              >
                {i + 1}
              </span>
              <CatalogImage
                src={resolveIcon(row.icon, FALLBACKS.player)}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0 flex-1 truncate font-medium text-white">
                {row.name}
              </span>
              <span className="shrink-0 text-right">
                <span className="font-display text-xl text-white">
                  {row.value}
                </span>{" "}
                <span className="text-xs text-body">{valueLabel}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
