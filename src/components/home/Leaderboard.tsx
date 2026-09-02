"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SectionHead } from "@/components/home/HomeContent";
import { Reveal } from "@/components/ui/Reveal";
import { Select } from "@/components/ui/Select";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { leaderboardAction } from "@/server/actions/leaderboardActions";
import type { LeaderRow } from "@/server/services/leaderboardService";

const METRICS = [
  { value: "won", label: "Tournaments won" },
  { value: "matchesWon", label: "Matches won" },
  { value: "matchesPlayed", label: "Matches played" },
];

const VALUE_HEAD: Record<string, string> = {
  won: "Won",
  matchesWon: "Won",
  matchesPlayed: "Played",
};

export function Leaderboard({ rows: initialRows }: { rows: LeaderRow[] }) {
  const [metric, setMetric] = useState("matchesWon");
  const [rows, setRows] = useState<LeaderRow[]>(initialRows);
  // The initial "won" rows come from the server, so skip the first fetch.
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let active = true;
    void leaderboardAction({ payment: "ALL", games: [], metric }).then(
      (result) => {
        if (!active) return;
        setRows(result.ok ? result.data.slice(0, 5) : []);
      },
    );
    return () => {
      active = false;
    };
  }, [metric]);

  return (
    <section className="border-t border-white/8 bg-primary-panel">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead
              title="Leaderboard"
              description="Top players. Rank by tournaments won, matches won, or matches played."
            />
            <div className="w-52">
              <Select
                label="Ranking"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                options={METRICS}
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 py-14 text-center text-body">
              No rankings yet. They fill in as tournaments finish.
            </div>
          ) : (
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <table className="w-full text-left">
                <thead className="bg-black/25 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="w-20 px-5 py-3">Rank</th>
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3 text-right">
                      {VALUE_HEAD[metric] ?? "Won"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.name} className="border-t border-white/8">
                      <td className="px-5 py-4 font-display text-xl text-primary">
                        {i + 1}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-3">
                          <CatalogImage
                            src={resolveIcon(row.icon, FALLBACKS.player)}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <span className="truncate font-medium text-white">
                            {row.name}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-display text-lg text-white">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <Link
              href="/leaderboard"
              className="text-sm font-semibold text-primary hover:underline"
            >
              View full leaderboard
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
