import "server-only";
import {
  games,
  orgs,
  registrations,
  tournaments,
  users,
} from "../db";

export interface AdminStats {
  users: number;
  tournaments: number;
  games: number;
  activeGames: number;
  orgs: number;
  registrations: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [userCol, tourCol, gameCol, orgCol, regCol] = await Promise.all([
    users(),
    tournaments(),
    games(),
    orgs(),
    registrations(),
  ]);

  const [
    userCount,
    tournamentCount,
    gameCount,
    activeGameCount,
    orgCount,
    registrationCount,
  ] = await Promise.all([
    userCol.countDocuments({}),
    tourCol.countDocuments({}),
    gameCol.countDocuments({}),
    gameCol.countDocuments({ active: true }),
    orgCol.countDocuments({}),
    regCol.countDocuments({}),
  ]);

  return {
    users: userCount,
    tournaments: tournamentCount,
    games: gameCount,
    activeGames: activeGameCount,
    orgs: orgCount,
    registrations: registrationCount,
  };
}
