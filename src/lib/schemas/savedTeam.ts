import { z } from "zod";
import { orgInviteStatusSchema } from "./common";

/**
 * Saved teams are rosters a player keeps on their profile and reuses when
 * entering tournaments. Distinct from `Teams` in `draw.ts`, which is a team as
 * it exists inside one tournament.
 */
export const savedTeamRoleSchema = z.enum(["CAPTAIN", "MEMBER"]);
export type SavedTeamRole = z.infer<typeof savedTeamRoleSchema>;

export const savedTeamMemberSchema = z.object({
  user_id: z.string(),
  role: savedTeamRoleSchema.default("MEMBER"),
  user_name: z.string().default(""),
  first_name: z.string().default(""),
  email: z.string().default(""),
  icon: z.string().default(""),
  verified: z.boolean().default(false),
  game_user_name: z.string().default(""),
  created_at: z.string().default(""),
});
export type SavedTeamMember = z.infer<typeof savedTeamMemberSchema>;

export const savedTeamSchema = z.object({
  team_id: z.string(),
  name: z.string(),
  icon: z.string().default(""),
  captain_id: z.string(),
  members: z.array(savedTeamMemberSchema).default([]),
  /** Convenience for the UI: whether the viewer captains this team. */
  isCaptain: z.boolean().default(false),
  created_at: z.string().default(""),
});
export type SavedTeam = z.infer<typeof savedTeamSchema>;

export const savedTeamInviteSchema = z.object({
  invite_id: z.string(),
  team_id: z.string(),
  team_name: z.string().default(""),
  team_icon: z.string().default(""),
  inviter_id: z.string().default(""),
  inviter_name: z.string().default(""),
  invitee_id: z.string(),
  status: orgInviteStatusSchema.default("PENDING"),
  created_at: z.string().default(""),
});
export type SavedTeamInvite = z.infer<typeof savedTeamInviteSchema>;

export const createSavedTeamInputSchema = z.object({
  name: z.string().trim().min(2, "Name your team").max(60),
  icon: z.string().min(1).max(500),
  game_user_name: z.string().trim().max(60).optional().default(""),
});
export type CreateSavedTeamInput = z.infer<typeof createSavedTeamInputSchema>;

export const updateSavedTeamInputSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    icon: z.string().min(1).max(500).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Nothing to update",
  });
export type UpdateSavedTeamInput = z.infer<typeof updateSavedTeamInputSchema>;

export const inviteToSavedTeamInputSchema = z.object({
  usernameOrEmail: z.string().trim().min(2).max(120),
});
export type InviteToSavedTeamInput = z.infer<
  typeof inviteToSavedTeamInputSchema
>;

export const setGameUserNameInputSchema = z.object({
  game_user_name: z.string().trim().max(60),
});
export type SetGameUserNameInput = z.infer<typeof setGameUserNameInputSchema>;
