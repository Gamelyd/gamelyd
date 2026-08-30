import { z } from "zod";
import {
  knockoutFormatSchema,
  paymentSchema,
  currencySchema,
  shuffleSchema,
  teamSizeSchema,
  tieBreakerSchema,
  tournamentModeSchema,
  tournamentTypeSchema,
} from "./common";
import { teamsSchema } from "./draw";

export const pointSystemSchema = z.object({
  Win: z.coerce.number().min(0).max(20).default(3),
  Draw: z.coerce.number().min(0).max(20).default(1),
});
export type PointSystem = z.infer<typeof pointSystemSchema>;

export const prizePositionSchema = z.object({
  Position: z.number().int().positive(),
  Amount: z.number().default(0),
  /** Percent of the net paid pot (0-100). Used for PAID events. */
  Share: z.number().min(0).max(100).default(0),
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

export const groupQualifierSchema = z.object({
  GroupName: z.string().min(1),
  TeamName: z.string().min(1),
  Reason: z.string().trim().min(3).max(280),
  Seed: z.number().int().min(1).max(8),
});
export type GroupQualifier = z.infer<typeof groupQualifierSchema>;

export const setGroupQualifiersInputSchema = z.object({
  Qualifiers: z.array(groupQualifierSchema).default([]),
});
export type SetGroupQualifiersInput = z.infer<
  typeof setGroupQualifiersInputSchema
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
  verified: z.boolean().default(false),
});
export type TournamentManager = z.infer<typeof tournamentManagerSchema>;

export const tournamentAnnouncementSchema = z.object({
  Id: z.string(),
  Body: z.string(),
  CreatedAt: z.string(),
  AuthorId: z.string().default(""),
});
export type TournamentAnnouncement = z.infer<
  typeof tournamentAnnouncementSchema
>;

export const pendingSettingChangeSchema = z.object({
  Id: z.string(),
  ProposedBy: z.string().default(""),
  CreatedAt: z.string().default(""),
  Summary: z.string().default(""),
  Patch: z.record(z.string(), z.unknown()).default({}),
  RequiredUserIds: z.array(z.string()).default([]),
  AcceptedUserIds: z.array(z.string()).default([]),
});
export type PendingSettingChange = z.infer<typeof pendingSettingChangeSchema>;

export const tournamentVenueSchema = z.object({
  country: z.string().max(2).default(""),
  location: z.string().max(200).default(""),
  lat: z.number().default(0),
  lng: z.number().default(0),
});
export type TournamentVenue = z.infer<typeof tournamentVenueSchema>;

export const tournamentVenueInputSchema = z.object({
  country: z.string().max(2).optional().default(""),
  location: z.string().max(200).optional().default(""),
  /**
   * Set when the host picked the venue from search. Zero means "not chosen",
   * and the server falls back to geocoding the text.
   */
  lat: z.coerce.number().min(-90).max(90).optional().default(0),
  lng: z.coerce.number().min(-180).max(180).optional().default(0),
});
export type TournamentVenueInput = z.infer<typeof tournamentVenueInputSchema>;

export const addAnnouncementInputSchema = z.object({
  Body: z.string().trim().min(1, "Write an announcement").max(2000),
});
export type AddAnnouncementInput = z.infer<typeof addAnnouncementInputSchema>;

export const tournamentSchema = z.object({
  _id: z.string(),
  Name: z.string(),
  GameName: z.string(),
  icon: z.string(),
  TournamentType: tournamentTypeSchema,
  Payment: paymentSchema,
  Currency: currencySchema.default("USD"),
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
  OrgVerified: z.boolean().default(false),
  CatalogKind: z.string().default("games"),
  FormatName: z.string().default(""),
  RosterCount: z.number().int().min(0).max(32).default(0),
  AllowDraw: z.boolean().default(true),
  ScoreLabel: z.enum(["Goals", "Points"]).default("Goals"),
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
  PlatformFeeBps: z.number().int().min(0).max(5000).default(1000),
  PurseFunded: z.boolean().default(true),
  PotNet: z.number().default(0),
  FeeCollected: z.number().default(0),
  SettlementStatus: z.enum(["NONE", "OPEN", "SETTLED"]).default("NONE"),
  /** Short plain-text summary used for link previews (social/share cards). */
  Description: z.string().optional().default(""),
  /** Long Markdown briefing and rules shown on the tournament page. */
  Note: z.string(),
  Announcements: z.array(tournamentAnnouncementSchema).default([]),
  PendingSettingChange: pendingSettingChangeSchema.optional(),
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
  /**
   * How many groups to split into. 0 means auto (about four teams per group).
   */
  GroupCount: z.number().int().min(0).max(8).default(0),
  /**
   * When true, the tournament owner (and co-managers) can drag teams between
   * groups before fixtures are drawn. When false, only a platform admin can.
   * Missing on older documents - treated as true so existing events keep
   * the current owner reshuffle behaviour.
   */
  OwnerCanReshuffleGroups: z.boolean().default(true),
  /**
   * When true, the tournament owner can add existing users before the event
   * starts. When false, only a platform admin can. Missing on older documents
   * is treated as false.
   */
  OwnerCanAddParticipants: z.boolean().default(false),
  /**
   * When true, the owner can pick who goes through if teams finish level on
   * points (with a public reason). When false, the table order decides.
   */
  OwnerCanSelectQualifiers: z.boolean().default(false),
  Qualifiers: z.array(groupQualifierSchema).default([]),
  DisqualifiedTeams: z.array(z.string()).default([]),
  KnockoutFormat: knockoutFormatSchema.default("SINGLE"),
  /**
   * When true, the final uses the same two-leg / best-of format as earlier
   * knockout rounds. When false (default), the final is one match. Third place
   * is always one match.
   */
  KnockoutFinalsSeries: z.boolean().default(false),
  ThirdPlace: z.boolean().default(false),
  TieBreaker: tieBreakerSchema.default("GOAL_DIFF"),
  BrLobbyCount: z.number().int().min(1).max(20).default(1),
  BrKillPoints: z.number().min(0).max(50).default(1),
  BrFirstBloodPoints: z.number().min(0).max(50).default(0),
  BrPlacementPoints: z.array(z.number()).default([12, 9, 7, 5, 4, 3, 2, 1]),
  RegistrationDeadline: z.string().default(""),
  CheckInRequired: z.boolean().default(false),
  CheckInOpens: z.string().default(""),
  CheckInCloses: z.string().default(""),
  FirstMatchAt: z.string().default(""),
  MatchIntervalMinutes: z.number().int().min(0).max(24 * 60).default(0),
  VenueCountry: z.string().default(""),
  VenueCity: z.string().default(""),
  VenueLocation: z.string().default(""),
  VenueLat: z.number().default(0),
  VenueLng: z.number().default(0),
  Venues: z.array(tournamentVenueSchema).default([]),
});
export type Tournament = z.infer<typeof tournamentSchema>;

export const saveTournamentInputSchema = z.object({
  Name: z.string().min(2).max(100),
  GameName: z.string().min(2).max(100),
  icon: z.string().min(1).max(500),
  TournamentType: tournamentTypeSchema,
  Payment: paymentSchema,
  Currency: currencySchema.optional().default("USD"),
  TournamentMode: tournamentModeSchema,
  TournamentSize: z.coerce.number().int().positive(),
  Team: teamSizeSchema,
  Shuffle: shuffleSchema,
  Date: z.string().min(1),
  Note: z.string().min(1),
  Description: z.string().optional().default(""),
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
  AdvancePerGroup: z.coerce.number().int().min(1).max(8).optional().default(2),
  GroupCount: z.coerce.number().int().min(0).max(8).optional().default(0),
  OwnerCanSelectQualifiers: z.boolean().optional().default(false),
  KnockoutFormat: knockoutFormatSchema.optional().default("SINGLE"),
  KnockoutFinalsSeries: z.boolean().optional().default(false),
  ThirdPlace: z.boolean().optional().default(false),
  TieBreaker: tieBreakerSchema.optional().default("GOAL_DIFF"),
  BrLobbyCount: z.coerce.number().int().min(1).max(20).optional().default(1),
  BrKillPoints: z.coerce.number().min(0).max(50).optional().default(1),
  BrFirstBloodPoints: z.coerce.number().min(0).max(50).optional().default(0),
  BrPlacementPoints: z.array(z.coerce.number()).optional(),
  RegistrationDeadline: z.string().optional().default(""),
  CheckInRequired: z.boolean().optional().default(false),
  CheckInOpens: z.string().optional().default(""),
  CheckInCloses: z.string().optional().default(""),
  FirstMatchAt: z.string().optional().default(""),
  MatchIntervalMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional()
    .default(0),
  CatalogKind: z.string().min(1).max(40).optional().default("games"),
  FormatName: z.string().max(40).optional().default(""),
  RosterCount: z.coerce.number().int().min(0).max(32).optional().default(0),
  AllowDraw: z.boolean().optional().default(true),
  ScoreLabel: z.enum(["Goals", "Points"]).optional().default("Goals"),
  VenueCountry: z.string().max(2).optional().default(""),
  VenueCity: z.string().max(80).optional().default(""),
  VenueLocation: z.string().max(200).optional().default(""),
  VenueLat: z.coerce.number().min(-90).max(90).optional().default(0),
  VenueLng: z.coerce.number().min(-180).max(180).optional().default(0),
  Venues: z.array(tournamentVenueInputSchema).max(8).optional().default([]),
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
    Team: teamSizeSchema.optional(),
    RosterCount: z.coerce.number().int().min(1).max(32).optional(),
    Name: z.string().min(2).max(100).optional(),
    Date: z.string().min(1).optional(),
    Note: z.string().min(1).optional(),
    Description: z.string().optional(),
    ReturnLeg: z.boolean().optional(),
    AdvancePerGroup: z.coerce.number().int().min(1).max(8).optional(),
    GroupCount: z.coerce.number().int().min(0).max(8).optional(),
    PointSystem: pointSystemSchema.optional(),
    OwnerCanSelectQualifiers: z.boolean().optional(),
    KnockoutFormat: knockoutFormatSchema.optional(),
    KnockoutFinalsSeries: z.boolean().optional(),
    ThirdPlace: z.boolean().optional(),
    TieBreaker: tieBreakerSchema.optional(),
    BrLobbyCount: z.coerce.number().int().min(1).max(20).optional(),
    BrKillPoints: z.coerce.number().min(0).max(50).optional(),
    BrFirstBloodPoints: z.coerce.number().min(0).max(50).optional(),
    BrPlacementPoints: z.array(z.coerce.number()).optional(),
    RegistrationDeadline: z.string().optional(),
    CheckInRequired: z.boolean().optional(),
    CheckInOpens: z.string().optional(),
    CheckInCloses: z.string().optional(),
    FirstMatchAt: z.string().optional(),
    MatchIntervalMinutes: z.coerce
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .optional(),
    icon: z.string().min(1).max(500).optional(),
    VenueCountry: z.string().max(2).optional(),
    VenueCity: z.string().max(80).optional(),
    VenueLocation: z.string().max(200).optional(),
    VenueLat: z.coerce.number().min(-90).max(90).optional(),
    VenueLng: z.coerce.number().min(-180).max(180).optional(),
    Venues: z.array(tournamentVenueInputSchema).max(8).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Nothing to update",
  });
export type EditTournamentInput = z.infer<typeof editTournamentInputSchema>;

/** Host/admin: register existing users onto a tournament that has not started. */
export const adminAddParticipantsInputSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(32),
  teamName: z.string().max(100).optional().default(""),
  existingTeamName: z.string().max(100).optional().default(""),
});
export type AdminAddParticipantsInput = z.infer<
  typeof adminAddParticipantsInputSchema
>;
