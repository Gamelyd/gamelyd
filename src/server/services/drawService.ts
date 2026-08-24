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
        Updated_at: new Date().toISOString(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
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
