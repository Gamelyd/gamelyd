import "server-only";
import { users } from "./db";
import type { Player, Draw, Teams, BRTeams } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Tournament } from "@/lib/schemas/tournament";

export async function loadVerifiedUserIds(
  userIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return new Set();
  const col = await users();
  const docs = await col
    .find({ user_id: { $in: unique }, verified: true })
    .project({ user_id: 1 })
    .toArray();
  return new Set(docs.map((doc) => doc.user_id));
}

function stampPlayer(player: Player, verified: Set<string>): Player {
  return { ...player, Verified: verified.has(player.User_id) };
}

function stampTeam(team: Teams | undefined, verified: Set<string>): Teams | undefined {
  if (!team) return team;
  return {
    ...team,
    Players: (team.Players ?? []).map((p) => stampPlayer(p, verified)),
  };
}

function stampBrTeam(team: BRTeams, verified: Set<string>): BRTeams {
  return {
    ...team,
    Players: (team.Players ?? []).map((p) => stampPlayer(p, verified)),
  };
}

export function stampDrawVerified(draw: Draw, verified: Set<string>): Draw {
  return {
    ...draw,
    Team1: stampTeam(draw.Team1, verified),
    Team2: stampTeam(draw.Team2, verified),
    BRTeams: (draw.BRTeams ?? []).map((team) => stampBrTeam(team, verified)),
  };
}

export function stampRegistrationVerified(
  reg: RegisterTournament,
  verified: Set<string>,
): RegisterTournament {
  return {
    ...reg,
    Players: (reg.Players ?? []).map((p) => stampPlayer(p, verified)),
  };
}

export function stampTournamentGroupsVerified(
  tournament: Tournament,
  verified: Set<string>,
): Tournament {
  return {
    ...tournament,
    Groups: (tournament.Groups ?? []).map((group) => ({
      ...group,
      Teams: (group.Teams ?? []).map((team) => stampTeam(team, verified) ?? team),
    })),
    Winner: stampTeam(tournament.Winner, verified),
  };
}

export function playerIdsFromDraws(draws: Draw[]): string[] {
  return draws.flatMap((draw) => [
    ...(draw.Team1?.Players ?? []),
    ...(draw.Team2?.Players ?? []),
    ...(draw.BRTeams ?? []).flatMap((team) => team.Players ?? []),
  ]).map((p) => p.User_id);
}

export function playerIdsFromRegs(regs: RegisterTournament[]): string[] {
  return regs.flatMap((reg) => (reg.Players ?? []).map((p) => p.User_id));
}

export function playerIdsFromTournament(tournament: Tournament): string[] {
  const fromGroups = (tournament.Groups ?? []).flatMap((group) =>
    (group.Teams ?? []).flatMap((team) => (team.Players ?? []).map((p) => p.User_id)),
  );
  const fromWinner = (tournament.Winner?.Players ?? []).map((p) => p.User_id);
  return [...fromGroups, ...fromWinner];
}

export async function hydrateRegistrations(
  regs: RegisterTournament[],
): Promise<RegisterTournament[]> {
  const verified = await loadVerifiedUserIds(playerIdsFromRegs(regs));
  return regs.map((reg) => stampRegistrationVerified(reg, verified));
}

export async function hydrateDraws(draws: Draw[]): Promise<Draw[]> {
  const verified = await loadVerifiedUserIds(playerIdsFromDraws(draws));
  return draws.map((draw) => stampDrawVerified(draw, verified));
}

export async function hydrateDraw(draw: Draw): Promise<Draw> {
  const [hydrated] = await hydrateDraws([draw]);
  return hydrated;
}

export async function hydrateTournament(
  tournament: Tournament,
): Promise<Tournament> {
  const verified = await loadVerifiedUserIds(playerIdsFromTournament(tournament));
  return stampTournamentGroupsVerified(tournament, verified);
}
