import { z } from "zod";
import {
  paymentSchema,
  shuffleSchema,
  teamSizeSchema,
  tournamentModeSchema,
  tournamentTypeSchema,
} from "./common";
import { teamsSchema } from "./draw";

export const pointSystemSchema = z.object({
  Win: z.number().default(3),
  Draw: z.number().default(1),
});
export type PointSystem = z.infer<typeof pointSystemSchema>;

export const prizePositionSchema = z.object({
  Position: z.number().int().positive(),
  Amount: z.number().default(0),
});
export type PrizePosition = z.infer<typeof prizePositionSchema>;

export function placeLabel(position: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const value = position % 100;
  return `${position}${suffix[(value - 20) % 10] || suffix[value] || suffix[0]}`;
}

export const tournamentGroupSchema = z.object({
  GroupName: z.string(),
  Teams: z.array(teamsSchema).default([]),
});
export type TournamentGroup = z.infer<typeof tournamentGroupSchema>;

/** How many teams from each group advance to the knockout stage. */
export const advanceGroupStageInputSchema = z.object({
  AdvancePerGroup: z.coerce.number().int().min(1).max(8).default(2),
});
export type AdvanceGroupStageInput = z.infer<
  typeof advanceGroupStageInputSchema
>;

/** Manual group arrangement: which team names sit in each group, in order. */
export const setGroupsInputSchema = z.object({
  Groups: z
    .array(
      z.object({
        GroupName: z.string().min(1),
        TeamNames: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});
export type SetGroupsInput = z.infer<typeof setGroupsInputSchema>;

/** A user allowed to help run a tournament, hydrated with their profile. */
export const tournamentManagerSchema = z.object({
  user_id: z.string(),
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  user_name: z.string().default(""),
  email: z.string().default(""),
});
export type TournamentManager = z.infer<typeof tournamentManagerSchema>;

export const tournamentSchema = z.object({
  _id: z.string(),
  Name: z.string(),
  GameName: z.string(),
  icon: z.string(),
  TournamentType: tournamentTypeSchema,
  Payment: paymentSchema,
  TournamentMode: tournamentModeSchema,
  TournamentSize: z.number(),
  Team: teamSizeSchema,
  Shuffle: shuffleSchema,
  Created_at: z.string(),
  Updated_at: z.string().default(""),
  TournamentId: z.string(),
  User_id: z.string(),
  OrgId: z.string().default(""),
  OrgName: z.string().default(""),
  OrgIcon: z.string().default(""),
  Active: z.boolean().default(false),
  IsDeleted: z.boolean().default(false),
  IsSuspended: z.boolean().default(false),
  Start: z.boolean().default(false),
  Link: z.string().default(""),
  Date: z.string(),
  IsPaid: z.boolean().default(false),
  IsDrawn: z.boolean().default(false),
  RefNumber: z.string().default(""),
  PaymentChannel: z.string().default(""),
  Amount: z.number().default(0),
  RegistrationAmount: z.number().default(0),
  Prizes: z.array(prizePositionSchema).default([]),
  Note: z.string(),
  AcceptedInvites: z.array(z.string()).default([]),
  Platform: z.string().default(""),
  Winner: teamsSchema.optional(),
  Stage: z.number().default(0),
  Groups: z.array(tournamentGroupSchema).default([]),
  PointSystem: pointSystemSchema.default({ Win: 3, Draw: 1 }),
  ReturnLeg: z.boolean().default(false),
  Featured: z.boolean().default(false),
  Managers: z.array(z.string()).default([]),
  AdvancePerGroup: z.number().int().positive().default(2),
});
export type Tournament = z.infer<typeof tournamentSchema>;

export const saveTournamentInputSchema = z.object({
  Name: z.string().min(2).max(100),
  GameName: z.string().min(2).max(100),
  icon: z.string().min(1).max(500),
  TournamentType: tournamentTypeSchema,
  Payment: paymentSchema,
  TournamentMode: tournamentModeSchema,
  TournamentSize: z.coerce.number().int().positive(),
  Team: teamSizeSchema,
  Shuffle: shuffleSchema,
  Date: z.string().min(1),
  Note: z.string().min(1),
  Link: z.string().optional().default(""),
  Platform: z.string().optional().default(""),
  Amount: z.coerce.number().default(0),
  RegistrationAmount: z.coerce.number().default(0),
  Prizes: z.array(prizePositionSchema).optional().default([]),
  RefNumber: z.string().optional().default(""),
  PaymentChannel: z.string().optional().default(""),
  PointSystem: pointSystemSchema.optional(),
  OrgId: z.string().optional().default(""),
  ReturnLeg: z.boolean().optional().default(false),
});
export type SaveTournamentInput = z.infer<typeof saveTournamentInputSchema>;

export const updateTournamentInputSchema = z.object({
  Name: z.string().min(2).max(100),
  GameName: z.string().min(2).max(100),
  TournamentType: tournamentTypeSchema,
  Shuffle: shuffleSchema,
  Team: teamSizeSchema,
  TournamentMode: tournamentModeSchema,
  TournamentSize: z.coerce.number().int().positive(),
  ReturnLeg: z.boolean().optional(),
});
export type UpdateTournamentInput = z.infer<typeof updateTournamentInputSchema>;

/**
 * Owner-editable settings, only applied before a tournament starts. Every field
 * is optional so each control can be saved on its own.
 */
export const editTournamentInputSchema = z
  .object({
    TournamentType: tournamentTypeSchema.optional(),
    Shuffle: shuffleSchema.optional(),
    TournamentSize: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Nothing to update",
  });
export type EditTournamentInput = z.infer<typeof editTournamentInputSchema>;
