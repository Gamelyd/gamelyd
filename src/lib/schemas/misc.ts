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
  /** Set on saved-team invites and captain alerts. */
  team_id: z.string().default(""),
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
/**
 * What a report is about. Players raise issues on tournaments; verified users
 * file CONTACT_CHANGE when they need an email or phone updated, since they
 * cannot edit those themselves.
 */
export const reportKindSchema = z.enum([
  "TOURNAMENT",
  "USER",
  "CONTACT_CHANGE",
  "OTHER",
]);
export type ReportKind = z.infer<typeof reportKindSchema>;

/** Preset reasons, so the admin inbox is filterable instead of free text. */
export const TOURNAMENT_REPORT_REASONS = [
  "Result is wrong",
  "Host is unresponsive",
  "Prize was not paid",
  "Cheating or unfair play",
  "Misleading details",
  "Something else",
] as const;

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
  Kind: reportKindSchema.default("OTHER"),
  TournamentId: z.string().default(""),
  TournamentName: z.string().default(""),
  Reason: z.string().default(""),
  RequestedEmail: z.string().default(""),
  RequestedPhone: z.string().default(""),
});
export type ReportAbuse = z.infer<typeof reportAbuseSchema>;

export const reportAbuseInputSchema = z.object({
  Email: z.string().email(),
  Name: z.string().min(1),
  Message: z.string().min(1),
  For: z.string().min(1),
  UserID: z.string().optional().default(""),
  Kind: reportKindSchema.optional().default("OTHER"),
  TournamentId: z.string().optional().default(""),
  TournamentName: z.string().optional().default(""),
  Reason: z.string().max(80).optional().default(""),
  RequestedEmail: z.string().optional().default(""),
  RequestedPhone: z.string().optional().default(""),
});
export type ReportAbuseInput = z.infer<typeof reportAbuseInputSchema>;

/** A player raising an issue about a tournament they can see. */
export const reportTournamentInputSchema = z.object({
  TournamentId: z.string().min(1),
  Reason: z.string().min(1, "Pick what this is about").max(80),
  Message: z
    .string()
    .trim()
    .min(10, "Tell us what happened, in a sentence or two")
    .max(2000),
});
export type ReportTournamentInput = z.infer<typeof reportTournamentInputSchema>;

/** A verified user asking us to change contact details they cannot self-edit. */
export const requestContactChangeInputSchema = z
  .object({
    Email: z.string().trim().email().optional().or(z.literal("")),
    Phone: z.string().trim().max(40).optional(),
    Message: z.string().trim().max(1000).optional().default(""),
  })
  .refine((d) => Boolean(d.Email?.trim() || d.Phone?.trim()), {
    message: "Enter the new email or phone number you want",
  });
export type RequestContactChangeInput = z.infer<
  typeof requestContactChangeInputSchema
>;
