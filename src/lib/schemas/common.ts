import { z } from "zod";

/** Shared enums (mirrors the Go validator `eq=` tags). */
export const userTypeSchema = z.enum(["ADMIN", "USER"]);
export type UserType = z.infer<typeof userTypeSchema>;

export const tournamentTypeSchema = z.enum(["PUBLIC", "PRIVATE"]);
export type TournamentType = z.infer<typeof tournamentTypeSchema>;

export const paymentSchema = z.enum(["FREE", "PAID", "SPONSORED"]);
export type Payment = z.infer<typeof paymentSchema>;

/** ISO 4217 codes hosts can stake or charge in. Missing on older docs → USD. */
export const currencySchema = z.enum([
  "USD",
  "NGN",
  "GBP",
  "EUR",
  "GHS",
  "KES",
  "ZAR",
]);
export type Currency = z.infer<typeof currencySchema>;

export const tournamentModeSchema = z.enum([
  "MULTIPLAYER",
  "BATTLEROYALE",
  "GROUPS",
  "LEAGUE",
]);
export type TournamentMode = z.infer<typeof tournamentModeSchema>;

export const teamSizeSchema = z.enum(["SINGLE", "DUO", "SQUAD"]);
export type TeamSize = z.infer<typeof teamSizeSchema>;

/** Players allowed on a registered team (host-selected count, else Solo/Duo/Squad). */
export function rosterSize(team: string, rosterCount = 0): number {
  if (typeof rosterCount === "number" && rosterCount > 0) return rosterCount;
  if (team === "DUO") return 2;
  if (team === "SQUAD") return 4;
  return 1;
}

export function rosterOverCapMessage(needed: number): string {
  return `A team cannot have more than ${needed} player${needed === 1 ? "" : "s"}`;
}

export function rosterSpotsLeftMessage(left: number, needed: number): string {
  if (left <= 0) return rosterOverCapMessage(needed);
  return `This team only has ${left} spot${left === 1 ? "" : "s"} left (max ${needed} players)`;
}

export const shuffleSchema = z.enum(["MANUAL", "AUTOMATIC"]);
export type Shuffle = z.infer<typeof shuffleSchema>;

/** How a knockout pairing is decided. */
export const knockoutFormatSchema = z.enum([
  "SINGLE",
  "TWO_LEG",
  "BO3",
  "BO5",
]);
export type KnockoutFormat = z.infer<typeof knockoutFormatSchema>;

/** How equal points are ordered on a league / group table. */
export const tieBreakerSchema = z.enum(["GOAL_DIFF", "HEAD_TO_HEAD"]);
export type TieBreaker = z.infer<typeof tieBreakerSchema>;

export const winnerSchema = z.enum(["Team1", "Team2"]);
export type Winner = z.infer<typeof winnerSchema>;

export const orgRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const orgInviteStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
]);
export type OrgInviteStatus = z.infer<typeof orgInviteStatusSchema>;

export const tournamentInviteKindSchema = z.enum(["TOURNAMENT", "TEAM"]);
export type TournamentInviteKind = z.infer<typeof tournamentInviteKindSchema>;

export const notificationKindSchema = z.enum([
  "GENERIC",
  "TOURNAMENT_INVITE",
  "TEAM_INVITE",
  "DRAW",
  "SCORE",
  "TIME",
  "ANNOUNCEMENT",
  "SETTING_CHANGE",
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

/** A Mongo ObjectId rendered as a 24-char hex string on the wire. */
export const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

/** Standard API response envelope used across every endpoint. */
export interface ApiEnvelope<T> {
  message?: string;
  hasError: boolean;
  data?: T;
}
