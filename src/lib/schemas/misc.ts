import { z } from "zod";

/* ----------------------------- Invite ----------------------------- */
export const inviteTournamentSchema = z.object({
  _id: z.string(),
  tournament_id: z.string(),
  user_id: z.string(),
  CreatedAt: z.string(),
  UpdatedAt: z.string(),
});
export type InviteTournament = z.infer<typeof inviteTournamentSchema>;

/* -------------------------- Notification -------------------------- */
export const notificationSchema = z.object({
  _id: z.string(),
  user_id: z.string(),
  message: z.string(),
  timestamp: z.string(),
  is_read: z.boolean().default(false),
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
