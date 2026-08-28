import { z } from "zod";
import {
  notificationKindSchema,
  orgInviteStatusSchema,
  tournamentInviteKindSchema,
} from "./common";

/* ----------------------------- Invite ----------------------------- */
export const inviteTournamentSchema = z.object({
  _id: z.string(),
  invite_id: z.string(),
  kind: tournamentInviteKindSchema.default("TOURNAMENT"),
  tournament_id: z.string(),
  tournament_name: z.string().default(""),
  team_name: z.string().default(""),
  register_id: z.string().default(""),
  inviter_id: z.string().default(""),
  inviter_name: z.string().default(""),
  invitee_id: z.string(),
  invitee_name: z.string().default(""),
  status: orgInviteStatusSchema.default("PENDING"),
  CreatedAt: z.string(),
  UpdatedAt: z.string(),
});
export type InviteTournament = z.infer<typeof inviteTournamentSchema>;

export const sendInviteInputSchema = z.object({
  usernameOrEmail: z.string().trim().min(2).max(120),
});
export type SendInviteInput = z.infer<typeof sendInviteInputSchema>;

/* -------------------------- Notification -------------------------- */
export const notificationSchema = z.object({
  _id: z.string(),
  user_id: z.string(),
  message: z.string(),
  timestamp: z.string(),
  is_read: z.boolean().default(false),
  kind: notificationKindSchema.default("GENERIC"),
  invite_id: z.string().default(""),
  tournament_id: z.string().default(""),
});
export type Notification = z.infer<typeof notificationSchema>;

export const createNotificationInputSchema = z.object({
  UserID: z.string().min(1),
  Message: z.string().min(1),
});
export type CreateNotificationInput = z.infer<
  typeof createNotificationInputSchema
>;

/* ---------------------------- Contact Us -------------------------- */
export const contactUsSchema = z.object({
  _id: z.string(),
  Created_at: z.string(),
  Updated_at: z.string(),
  ContactId: z.string(),
  Email: z.string(),
  Name: z.string(),
  Message: z.string(),
  Achived: z.boolean().default(false),
  IsDeleted: z.boolean().default(false),
  IsCompleted: z.boolean().default(false),
});
export type ContactUs = z.infer<typeof contactUsSchema>;

export const contactUsInputSchema = z.object({
  Email: z.string().email(),
  Name: z.string().min(1),
  Message: z.string().min(1),
});
export type ContactUsInput = z.infer<typeof contactUsInputSchema>;

/* --------------------------- Report Abuse ------------------------- */
export const reportAbuseSchema = z.object({
  _id: z.string(),
  Created_at: z.string(),
  Updated_at: z.string(),
  ReportAbuseId: z.string(),
  UserID: z.string().default(""),
  Email: z.string(),
  Name: z.string(),
  Message: z.string(),
  For: z.string(),
  Achived: z.boolean().default(false),
  IsDeleted: z.boolean().default(false),
  IsCompleted: z.boolean().default(false),
});
export type ReportAbuse = z.infer<typeof reportAbuseSchema>;

export const reportAbuseInputSchema = z.object({
  Email: z.string().email(),
  Name: z.string().min(1),
  Message: z.string().min(1),
  For: z.string().min(1),
  UserID: z.string().optional().default(""),
});
export type ReportAbuseInput = z.infer<typeof reportAbuseInputSchema>;
