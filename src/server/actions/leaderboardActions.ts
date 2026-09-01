"use server";

import { ok, fail, type ActionResult } from "@/lib/result";
import {
  getLeaderboard,
  type LeaderRow,
} from "@/server/services/leaderboardService";

export async function leaderboardAction(opts: {
  payment: string;
  games: string[];
  metric: string;
}): Promise<ActionResult<LeaderRow[]>> {
  const payment =
    opts.payment === "FREE" || opts.payment === "SPONSORED"
      ? opts.payment
      : "ALL";
  const metric =
    opts.metric === "matchesWon" || opts.metric === "matchesPlayed"
      ? opts.metric
      : "won";
  const games = (opts.games ?? [])
    .filter((g): g is string => typeof g === "string" && g.trim() !== "")
    .slice(0, 2);
  try {
    return ok(await getLeaderboard({ payment, games, metric }));
  } catch (error) {
    console.error(error);
    return fail("Could not load the leaderboard");
  }
}
