import "server-only";
import { tournaments, draws } from "@/server/db";
import { serializeTournament, serializeDraw } from "@/server/serialize";
import { endedWinnerClause } from "@/lib/tournamentStatus";
import type { TournamentDoc, DrawDoc } from "@/server/documents";

export type LeaderMetric = "won" | "matchesWon" | "matchesPlayed";
export type LeaderPayment = "ALL" | "FREE" | "SPONSORED";

export interface LeaderRow {
  name: string;
  icon: string;
  value: number;
}

/**
 * Ranks players across tournaments by tournaments won, matches won, or matches
 * played (every player on the relevant team is credited), filtered by payment
 * and game.
 */
export async function getLeaderboard(opts: {
  payment: LeaderPayment;
  games: string[];
  metric: LeaderMetric;
  limit?: number;
}): Promise<LeaderRow[]> {
  const limit = opts.limit ?? 50;

  const clauses: Record<string, unknown>[] = [
    { $or: [{ IsDeleted: { $ne: true } }, { isdeleted: { $ne: true } }] },
  ];
  if (opts.payment !== "ALL") {
    clauses.push({
      $or: [{ Payment: opts.payment }, { payment: opts.payment }],
    });
  }
  if (opts.games.length > 0) {
    const ors = opts.games.flatMap((game) => {
      const rx = {
        $regex: `^${game.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      };
      return [{ GameName: rx }, { gamename: rx }];
    });
    clauses.push({ $or: ors });
  }
  if (opts.metric === "won") clauses.push(endedWinnerClause());

  const tCol = await tournaments();
  const docs = await tCol
    .find({ $and: clauses } as never)
    .limit(3000)
    .toArray();
  const events = docs.map((d) => serializeTournament(d as TournamentDoc));

  // Ranked per player: every player on a winning team gets the win.
  const tally = new Map<string, { name: string; icon: string; value: number }>();
  const addPlayers = (
    players: { User_id?: string; UserName?: string; Icon?: string }[] | undefined,
  ) => {
    for (const p of players ?? []) {
      const id = (p.User_id ?? "").trim();
      if (!id) continue;
      const cur = tally.get(id) ?? { name: p.UserName || "Player", icon: "", value: 0 };
      cur.value += 1;
      if (p.UserName && (cur.name === "Player" || !cur.name)) cur.name = p.UserName;
      if (!cur.icon && p.Icon) cur.icon = p.Icon;
      tally.set(id, cur);
    }
  };

  if (opts.metric === "won") {
    for (const t of events) addPlayers(t.Winner?.Players);
  } else {
    const played = opts.metric === "matchesPlayed";
    const ids = events.flatMap((t) =>
      [t.TournamentId, t._id].filter((v): v is string => Boolean(v)),
    );
    if (ids.length > 0) {
      const dCol = await draws();
      const drawDocs = await dCol
        .find({
          $or: [
            { TournamentId: { $in: ids } },
            { tournamentid: { $in: ids } },
          ],
        } as never)
        .limit(50000)
        .toArray();
      for (const dd of drawDocs) {
        const d = serializeDraw(dd as DrawDoc);
        if ((d.BRTeams ?? []).length > 0) {
          if (played) {
            // Everyone in the lobby played it.
            for (const t of d.BRTeams) addPlayers(t.Players);
          } else {
            // Won by whoever placed first.
            addPlayers(d.BRTeams.find((t) => t.Placement === 1)?.Players);
          }
          continue;
        }
        if (!d.Played) continue;
        if (played) {
          addPlayers(d.Team1?.Players);
          addPlayers(d.Team2?.Players);
        } else if (d.Winner === "Team1" || d.Team1Score > d.Team2Score) {
          // A head-to-head win: recorded winner, else the higher score.
          addPlayers(d.Team1?.Players);
        } else if (d.Winner === "Team2" || d.Team2Score > d.Team1Score) {
          addPlayers(d.Team2?.Players);
        }
      }
    }
  }

  return [...tally.values()]
    .map((v) => ({ name: v.name, icon: v.icon, value: v.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
