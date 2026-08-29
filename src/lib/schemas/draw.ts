import { z } from "zod";
import { winnerSchema } from "./common";

function playerString() {
  return z.preprocess((value) => {
    if (typeof value !== "string") return "";
    if (value === "$undefined") return "";
    return value;
  }, z.string());
}

export const playerSchema = z.object({
  UserName: playerString(),
  GameUserName: playerString(),
  User_id: z.string().min(1),
  Email: playerString(),
  Icon: playerString(),
  Verified: z.boolean().default(false),
});
export type Player = z.infer<typeof playerSchema>;

export const teamsSchema = z.object({
  TeamName: z.string().default(""),
  Players: z.array(playerSchema).default([]),
  Icon: z.string().default(""),
  Points: z.number().default(0),
  GoalsScored: z.number().default(0),
  GoalsReceived: z.number().default(0),
  GoalsDifference: z.number().default(0),
});
export type Teams = z.infer<typeof teamsSchema>;

export const brTeamsSchema = z.object({
  TeamName: z.string(),
  Players: z.array(playerSchema),
  Wins: z.number().default(0),
  Kills: z.number().default(0),
  FirstBloods: z.number().default(0),
  Placement: z.number().int().min(0).max(64).default(0),
});
export type BRTeams = z.infer<typeof brTeamsSchema>;

export const drawSchema = z.object({
  _id: z.string(),
  Team1: teamsSchema.optional(),
  Team2: teamsSchema.optional(),
  Created_at: z.string(),
  Updated_at: z.string(),
  TournamentId: z.string(),
  DrawId: z.string(),
  Stage: z.number(),
  Winner: z.string().default(""),
  BRWinner: z.string().default(""),
  Time: z.string().default(""),
  Date: z.string().default(""),
  Team1Score: z.number().default(0),
  Team2Score: z.number().default(0),
  Link: z.string().default(""),
  Group: z.string().default(""),
  BRTeams: z.array(brTeamsSchema).default([]),
  Played: z.boolean().default(false),
  SeriesId: z.string().default(""),
  Leg: z.number().int().min(1).default(1),
  Kind: z.string().default(""),
  /** Per-match venue, set by the host. Empty when the match has no place yet. */
  VenueName: z.string().default(""),
  VenueCountry: z.string().default(""),
  VenueLat: z.number().default(0),
  VenueLng: z.number().default(0),
});
export type Draw = z.infer<typeof drawSchema>;

/* ----------------------------- Inputs ----------------------------- */

export const newDrawInputSchema = z.object({
  TournamentId: z.string().min(1),
});
export type NewDrawInput = z.infer<typeof newDrawInputSchema>;

export const addWinnerInputSchema = z.object({
  Winner: winnerSchema,
});
export type AddWinnerInput = z.infer<typeof addWinnerInputSchema>;

export const addTimeInputSchema = z.object({
  Time: z.string().min(1),
  Date: z.string().min(1),
});
export type AddTimeInput = z.infer<typeof addTimeInputSchema>;

export const addScoreInputSchema = z.object({
  Team1: z.coerce.number(),
  Team2: z.coerce.number(),
  Winner: z.string(),
  TournamentId: z.string(),
  WinnerTeam: z.string().optional().default(""),
  IsFinal: z.string().optional().default(""),
});
export type AddScoreInput = z.infer<typeof addScoreInputSchema>;

export const addLinkInputSchema = z.object({
  Link: z.string().min(1),
});
export type AddLinkInput = z.infer<typeof addLinkInputSchema>;

/**
 * Set (or clear) where a match is played. An empty name clears it; lat/lng are
 * only non-zero when the host picked the place from search.
 */
export const setDrawVenueInputSchema = z.object({
  VenueName: z.string().trim().max(200).default(""),
  VenueCountry: z.string().trim().max(2).default(""),
  VenueLat: z.coerce.number().min(-90).max(90).default(0),
  VenueLng: z.coerce.number().min(-180).max(180).default(0),
});
export type SetDrawVenueInput = z.infer<typeof setDrawVenueInputSchema>;

export const updateBrDrawInputSchema = z.object({
  Players: z.array(brTeamsSchema),
  Link: z.string().optional().default(""),
  Date: z.string().optional().default(""),
  Time: z.string().optional().default(""),
});
export type UpdateBrDrawInput = z.infer<typeof updateBrDrawInputSchema>;
