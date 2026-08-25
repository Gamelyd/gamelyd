import "server-only";
import { ObjectId } from "mongodb";
import { draws, registrations, tournaments } from "../db";
import type { DrawDoc, RegisterTournamentDoc, TournamentDoc } from "../documents";
import {
  serializeDraw,
  serializeRegistration,
  serializeTournament,
} from "../serialize";
import {
  asDocFilter,
  byAnyTournamentId,
  byDrawId,
  byTournamentId,
} from "../legacy";
import { relatedTournamentIds } from "./tournamentService";
import { ServiceError } from "./userService";
import { sendEmail } from "../email/mailer";
import { addLinkEmail, addTimeEmail } from "../email/templates";
import type { Draw, Teams } from "@/lib/schemas/draw";
import { hydrateDrawIcons, iconMapFromTeams } from "@/lib/teamIcons";
import type {
  AddScoreInput,
  AddTimeInput,
  UpdateBrDrawInput,
} from "@/lib/schemas/draw";
import {
  computeLeagueStandings,
  standingToTeam,
} from "@/lib/leagueStandings";
import type { AdvanceGroupStageInput } from "@/lib/schemas/tournament";
import { pairWithinHalves, seedKnockoutPairs } from "@/lib/knockoutSeed";

function emptyTeamFrom(team: Teams): Teams {
  return {
    TeamName: team.TeamName,
    Players: team.Players,
    Icon: team.Icon,
    Points: 0,
    GoalsScored: 0,
    GoalsReceived: 0,
    GoalsDifference: 0,
  };
}

/** Builds a knockout fixture (Group left empty). A missing team2 is a bye. */
function knockoutDraw(
  team1: Teams,
  team2: Teams | undefined,
  tournamentId: string,
  stage: number,
  now: string,
): DrawDoc {
  const _id = new ObjectId();
  return {
    _id,
    Team1: emptyTeamFrom(team1),
    Team2: team2 ? emptyTeamFrom(team2) : undefined,
    Created_at: now,
    Updated_at: now,
    TournamentId: tournamentId,
    DrawId: _id.toHexString(),
    Stage: stage,
    Winner: team2 ? "" : "Team1",
    BRWinner: "",
    Time: "",
    Date: "",
    Team1Score: 0,
    Team2Score: 0,
    Link: "",
    Group: "",
    BRTeams: [],
    // A bye is settled immediately so the round can complete.
    Played: !team2,
  };
}

/** Resolves the winning team of a played knockout tie, if decided. */
function knockoutWinner(draw: Draw): Teams | null {
  const decided =
    draw.Winner === "Team1"
      ? draw.Team1
      : draw.Winner === "Team2"
        ? draw.Team2
        : draw.Team1Score > draw.Team2Score
          ? draw.Team1
          : draw.Team2Score > draw.Team1Score
            ? draw.Team2
            : null;
  return decided ?? null;
}

function teamsFromRegistrations(regDocs: RegisterTournamentDoc[]): Teams[] {
  return regDocs.map((r) => {
    const reg = serializeRegistration(r);
    return {
      TeamName: reg.TeamName,
      Players: reg.Players,
      Icon: reg.Icon,
      Points: 0,
      GoalsScored: 0,
      GoalsReceived: 0,
      GoalsDifference: 0,
    };
  });
}

export async function newDraw(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  if (tournament.TournamentMode === "GROUPS") {
    throw new ServiceError(
      "Group tournaments use the group-stage draw. Draw group fixtures, then advance to the knockout.",
    );
  }
  if (tournament.TournamentMode === "LEAGUE") {
    throw new ServiceError("Use the league draw for league tournaments");
  }

  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();
  if (regDocs.length < 2) {
    throw new ServiceError("You need at least 2 teams to draw a tournament");
  }

  const teams = teamsFromRegistrations(regDocs);

  const ordered =
    tournament.Shuffle === "AUTOMATIC"
      ? [...teams].sort(() => Math.random() - 0.5)
      : teams;

  const stage = (tournament.Stage || 0) + 1;
  const now = new Date().toISOString();
  const drawDocs: DrawDoc[] = [];

  for (let i = 0; i < ordered.length; i += 2) {
    const team1 = ordered[i];
    const team2 = ordered[i + 1];
    const _id = new ObjectId();
    drawDocs.push({
      _id,
      Team1: emptyTeamFrom(team1),
      Team2: team2 ? emptyTeamFrom(team2) : undefined,
      Created_at: now,
      Updated_at: now,
      TournamentId: tournament.TournamentId,
      DrawId: _id.toHexString(),
      Stage: stage,
      Winner: team2 ? "" : "Team1",
      BRWinner: "",
      Time: "",
      Date: "",
      Team1Score: 0,
      Team2Score: 0,
      Link: "",
      Group: "",
      BRTeams: [],
      Played: false,
    });
  }

  const dCol = await draws();
  await dCol.insertMany(drawDocs);
  await tCol.updateOne(
    { _id: tournamentDoc._id },
    {
      $set: {
        Start: true,
        start: true,
        Stage: stage,
        stage,
        IsDrawn: true,
        isdrawn: true,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1],
  );

  return drawDocs.map(serializeDraw);
}

export async function drawBr(tournamentId: string): Promise<Draw> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();
  if (regDocs.length < 2) {
    throw new ServiceError("You need at least 2 teams to draw a tournament");
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: DrawDoc = {
    _id,
    Created_at: now,
    Updated_at: now,
    TournamentId: tournament.TournamentId,
    DrawId: _id.toHexString(),
    Stage: 1,
    Winner: "",
    BRWinner: "",
    Time: "",
    Date: "",
    Team1Score: 0,
    Team2Score: 0,
    Link: "",
    Group: "",
    BRTeams: teamsFromRegistrations(regDocs).map((r) => ({
      TeamName: r.TeamName,
      Players: r.Players,
      Wins: 0,
      Kills: 0,
      FirstBloods: 0,
    })),
    Played: false,
  };

  const dCol = await draws();
  await dCol.insertOne(doc);
  await tCol.updateOne(
    { _id: tournamentDoc._id },
    {
      $set: {
        Start: true,
        start: true,
        Stage: 1,
        stage: 1,
        IsDrawn: true,
        isdrawn: true,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1],
  );
  return serializeDraw(doc);
}

export async function drawLeague(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  if (tournament.TournamentMode !== "LEAGUE") {
    throw new ServiceError("This tournament is not a league");
  }
  if (tournament.IsDrawn) {
    throw new ServiceError("League fixtures have already been generated");
  }

  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();
  if (regDocs.length < 2) {
    throw new ServiceError("You need at least 2 teams to start a league");
  }

  const teams = teamsFromRegistrations(regDocs);
  const ordered =
    tournament.Shuffle === "AUTOMATIC" ? shuffleTeams(teams) : teams;
  const now = new Date().toISOString();
  const pairings = circleRoundRobin(ordered, tournament.ReturnLeg);
  const lastStage = pairings[pairings.length - 1]?.stage ?? 1;

  const drawDocs: DrawDoc[] = pairings.map((pair) => {
    const _id = new ObjectId();
    return {
      _id,
      Team1: emptyTeamFrom(pair.team1),
      Team2: emptyTeamFrom(pair.team2),
      Created_at: now,
      Updated_at: now,
      TournamentId: tournament.TournamentId,
      DrawId: _id.toHexString(),
      Stage: pair.stage,
      Winner: "",
      BRWinner: "",
      Time: "",
      Date: "",
      Team1Score: 0,
      Team2Score: 0,
      Link: "",
      Group: "",
      BRTeams: [],
      Played: false,
    };
  });

  const dCol = await draws();
  await dCol.insertMany(drawDocs);
  await tCol.updateOne(
    { _id: tournamentDoc._id },
    {
      $set: {
        Start: true,
        start: true,
        Stage: lastStage,
        stage: lastStage,
        IsDrawn: true,
        isdrawn: true,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1],
  );

  return drawDocs.map(serializeDraw);
}

/**
 * Group-stage fixtures: a single round-robin within each group, every match
 * tagged with its group name. Matchdays share stage numbers across groups.
 */
export async function drawGroupStage(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  if (tournament.TournamentMode !== "GROUPS") {
    throw new ServiceError("This tournament is not a group tournament");
  }
  if (!tournament.Groups || tournament.Groups.length === 0) {
    throw new ServiceError("Create groups before drawing fixtures");
  }

  const dCol = await draws();
  const existing = await dCol.countDocuments(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );
  if (existing > 0) {
    throw new ServiceError("Group fixtures have already been drawn");
  }

  const now = new Date().toISOString();
  const drawDocs: DrawDoc[] = [];
  let maxStage = 0;

  for (const group of tournament.Groups) {
    const pairings = circleRoundRobin(group.Teams, false);
    for (const pair of pairings) {
      maxStage = Math.max(maxStage, pair.stage);
      const _id = new ObjectId();
      drawDocs.push({
        _id,
        Team1: emptyTeamFrom(pair.team1),
        Team2: emptyTeamFrom(pair.team2),
        Created_at: now,
        Updated_at: now,
        TournamentId: tournament.TournamentId,
        DrawId: _id.toHexString(),
        Stage: pair.stage,
        Winner: "",
        BRWinner: "",
        Time: "",
        Date: "",
        Team1Score: 0,
        Team2Score: 0,
        Link: "",
        Group: group.GroupName,
        BRTeams: [],
        Played: false,
      });
    }
  }

  if (drawDocs.length === 0) {
    throw new ServiceError(
      "Each group needs at least two teams to draw fixtures",
    );
  }

  await dCol.insertMany(drawDocs);
  await tCol.updateOne(
    { _id: tournamentDoc._id },
    {
      $set: {
        Start: true,
        start: true,
        Stage: maxStage,
        stage: maxStage,
        IsDrawn: true,
        isdrawn: true,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1],
  );

  return drawDocs.map(serializeDraw);
}

/**
 * Seeds the knockout stage from group standings: the top N of each group
 * (N = AdvancePerGroup) qualify, then are paired best-vs-worst so group
 * winners meet runners-up from other groups.
 */
export async function advanceGroupStage(
  tournamentId: string,
  input: AdvanceGroupStageInput,
): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  if (tournament.TournamentMode !== "GROUPS") {
    throw new ServiceError("This tournament is not a group tournament");
  }
  if (!tournament.Groups || tournament.Groups.length === 0) {
    throw new ServiceError("This tournament has no groups");
  }

  const dCol = await draws();
  const allDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  const groupDraws = allDraws.filter((d) => d.Group);
  if (groupDraws.length === 0) {
    throw new ServiceError("Draw the group fixtures first");
  }
  const knockoutDraws = allDraws.filter(
    (d) => !d.Group && d.BRTeams.length === 0,
  );
  if (knockoutDraws.length > 0) {
    throw new ServiceError("The knockout stage has already been drawn");
  }
  if (groupDraws.some((d) => !d.Played)) {
    throw new ServiceError("Record every group result before advancing");
  }

  // Collect qualifiers grouped by finishing position so the seed order is
  // [all winners, all runners-up, ...].
  const byPosition: Teams[][] = [];
  for (const group of tournament.Groups) {
    const gDraws = groupDraws.filter((d) => d.Group === group.GroupName);
    const standings = computeLeagueStandings(
      group.Teams,
      gDraws,
      tournament.PointSystem,
    );
    standings.slice(0, input.AdvancePerGroup).forEach((row, pos) => {
      (byPosition[pos] ??= []).push(standingToTeam(row));
    });
  }

  const pairs = seedKnockoutPairs(byPosition);
  if (pairs.length === 0) {
    throw new ServiceError("Not enough qualifiers to make a knockout stage");
  }

  const now = new Date().toISOString();
  const nextStage = (tournament.Stage || 0) + 1;
  const drawDocs: DrawDoc[] = pairs.map(([team1, team2]) =>
    knockoutDraw(team1, team2, tournament.TournamentId, nextStage, now),
  );

  await dCol.insertMany(drawDocs);
  await tCol.updateOne(
    { _id: tournamentDoc._id },
    {
      $set: {
        Stage: nextStage,
        stage: nextStage,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1],
  );

  return drawDocs.map(serializeDraw);
}

/** Advances knockout-round winners into the next round. */
export async function drawKnockoutNext(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  const dCol = await draws();
  const allDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  const knockoutDraws = allDraws.filter(
    (d) => !d.Group && d.BRTeams.length === 0,
  );
  if (knockoutDraws.length === 0) {
    throw new ServiceError("Advance the group stage first");
  }

  const maxStage = Math.max(...knockoutDraws.map((d) => d.Stage));
  const current = knockoutDraws.filter((d) => d.Stage === maxStage);
  if (current.some((d) => !d.Played)) {
    throw new ServiceError("Finish the current knockout round first");
  }

  const winners = current
    .map((d) => knockoutWinner(d))
    .filter((team): team is Teams => Boolean(team));
  if (winners.length !== current.length) {
    throw new ServiceError(
      "Set a winner for every tie before drawing the next round",
    );
  }
  if (winners.length < 2) {
    throw new ServiceError("The knockout stage is already decided");
  }

  const now = new Date().toISOString();
  const nextStage = maxStage + 1;
  const drawDocs: DrawDoc[] = pairWithinHalves(winners).map(([team1, team2]) =>
    knockoutDraw(team1, team2, tournament.TournamentId, nextStage, now),
  );

  await dCol.insertMany(drawDocs);
  await tCol.updateOne(
    { _id: tournamentDoc._id },
    {
      $set: {
        Stage: nextStage,
        stage: nextStage,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1],
  );

  return drawDocs.map(serializeDraw);
}

export async function getDrawsByTournament(
  tournamentId: string,
): Promise<Draw[]> {
  const ids = await relatedTournamentIds(tournamentId);
  const col = await draws();
  const docs = await col
    .find(asDocFilter<DrawDoc>(byAnyTournamentId(ids)))
    .limit(1000)
    .toArray();
  const mapped = docs.map(serializeDraw);
  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .limit(1000)
    .toArray();
  const icons = iconMapFromTeams(regDocs.map(serializeRegistration));
  return mapped.map((draw) => hydrateDrawIcons(draw, icons));
}

export async function getDrawTournamentId(
  drawId: string,
): Promise<string | null> {
  const col = await draws();
  const found = await col.findOne(asDocFilter<DrawDoc>(byDrawId(drawId)));
  return found ? serializeDraw(found).TournamentId : null;
}

export async function addWinner(
  drawId: string,
  winner: string,
): Promise<Draw> {
  const col = await draws();
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    { $set: { Winner: winner, Updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");
  return serializeDraw(updated);
}

export async function addTime(
  drawId: string,
  input: AddTimeInput,
): Promise<Draw> {
  const col = await draws();
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    { $set: { Time: input.Time, Date: input.Date, Updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
  notifyPlayers(updated, (name, tournamentName) =>
    addTimeEmail(name, tournamentName, mapped.TournamentId, input.Time, input.Date),
  );
  return mapped;
}

export async function addScore(
  drawId: string,
  input: AddScoreInput,
): Promise<Draw> {
  const col = await draws();
  const winner =
    input.Team1 > input.Team2
      ? "Team1"
      : input.Team2 > input.Team1
        ? "Team2"
        : "";

  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    {
      $set: {
        Team1Score: input.Team1,
        Team2Score: input.Team2,
        Winner: input.Winner || winner,
        Played: true,
        played: true,
        Updated_at: new Date().toISOString(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
  await maybeFinishLeague(mapped);
  if (input.IsFinal === "true" && input.WinnerTeam) {
    const winningTeam =
      (input.Winner || winner) === "Team1" ? mapped.Team1 : mapped.Team2;
    if (winningTeam) {
      const tCol = await tournaments();
      await tCol.updateOne(
        asDocFilter<TournamentDoc>(byTournamentId(input.TournamentId)),
        {
          $set: {
            Winner: winningTeam,
            winner: winningTeam,
            Active: false,
            active: false,
            Updated_at: new Date().toISOString(),
          },
        } as unknown as Parameters<typeof tCol.updateOne>[1],
      );
    }
  }
  return mapped;
}

export async function addLink(drawId: string, link: string): Promise<Draw> {
  const col = await draws();
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    { $set: { Link: link, Updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
  notifyPlayers(updated, (name, tournamentName) =>
    addLinkEmail(name, tournamentName, mapped.TournamentId),
  );
  return mapped;
}

export async function updateBrDraw(
  drawId: string,
  input: UpdateBrDrawInput,
): Promise<Draw> {
  const col = await draws();
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    {
      $set: {
        BRTeams: input.Players,
        Link: input.Link,
        Date: input.Date,
        Time: input.Time,
        Updated_at: new Date().toISOString(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");
  return serializeDraw(updated);
}

/* --------------------------- helpers --------------------------- */

function shuffleTeams(teams: Teams[]): Teams[] {
  const ordered = [...teams];
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
}

function circleRoundRobin(
  teams: Teams[],
  returnLeg: boolean,
): { stage: number; team1: Teams; team2: Teams }[] {
  const rotation: (Teams | null)[] = [...teams];
  if (rotation.length % 2 === 1) rotation.push(null);

  const n = rotation.length;
  const rounds = n - 1;
  const half = n / 2;
  const firstHalf: { stage: number; team1: Teams; team2: Teams }[] = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i];
      const away = rotation[n - 1 - i];
      if (!home || !away) continue;
      firstHalf.push({ stage: round + 1, team1: home, team2: away });
    }
    const last = rotation.pop();
    if (last !== undefined) rotation.splice(1, 0, last);
  }

  if (!returnLeg) return firstHalf;

  return [
    ...firstHalf,
    ...firstHalf.map((pair) => ({
      stage: pair.stage + rounds,
      team1: pair.team2,
      team2: pair.team1,
    })),
  ];
}

async function maybeFinishLeague(draw: Draw): Promise<void> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(draw.TournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) return;
  const tournament = serializeTournament(tournamentDoc);
  if (tournament.TournamentMode !== "LEAGUE") return;

  const leagueDraws = await getDrawsByTournament(draw.TournamentId);
  if (leagueDraws.length === 0 || leagueDraws.some((item) => !item.Played)) {
    return;
  }

  const teams = leagueDraws.flatMap((item) =>
    [item.Team1, item.Team2].filter((team): team is Teams => Boolean(team)),
  );
  const unique = [...new Map(teams.map((team) => [team.TeamName, team])).values()];
  const table = computeLeagueStandings(
    unique,
    leagueDraws,
    tournament.PointSystem,
  );
  const leader = table[0];
  if (!leader) return;

  await tCol.updateOne(
    { _id: tournamentDoc._id },
    {
      $set: {
        Winner: standingToTeam(leader),
        winner: standingToTeam(leader),
        Active: false,
        active: false,
        Updated_at: new Date().toISOString(),
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1],
  );
}

async function notifyPlayers(
  draw: DrawDoc,
  build: (name: string, tournamentName: string) => { subject: string; html: string },
): Promise<void> {
  const mapped = serializeDraw(draw);
  const tournamentDoc = await (await tournaments()).findOne(
    asDocFilter<TournamentDoc>(byTournamentId(mapped.TournamentId)),
  );
  const tournamentName = tournamentDoc
    ? serializeTournament(tournamentDoc).Name
    : "your tournament";
  const players = [
    ...(mapped.Team1?.Players ?? []),
    ...(mapped.Team2?.Players ?? []),
  ];
  for (const player of players) {
    if (player.Email) {
      void sendEmail(player.Email, build(player.UserName, tournamentName));
    }
  }
}
