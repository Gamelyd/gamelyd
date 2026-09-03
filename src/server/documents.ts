import "server-only";
import type { ObjectId } from "mongodb";
import type {
  NotificationKind,
  OrgInviteStatus,
  OrgRole,
  TournamentInviteKind,
  UserType,
} from "@/lib/schemas/common";
import type { Player, Teams, BRTeams } from "@/lib/schemas/draw";
import type { SavedTeamRole } from "@/lib/schemas/savedTeam";
import type { ReportKind } from "@/lib/schemas/misc";
import type { Plan, PlanConfig } from "@/lib/plans";
import type { TournamentTemplate } from "@/lib/tournamentTemplates";
import type { SaveTournamentInput } from "@/lib/schemas/tournament";
import type {
  PointSystem,
  PrizePosition,
  TournamentGroup,
} from "@/lib/schemas/tournament";

/**
 * MongoDB document shapes (as stored). Dates are stored as ISO strings and
 * `_id` is a real ObjectId. Public API types (in `@/lib/schemas`) are the
 * serialized versions of these.
 */

export interface UserDoc {
  _id: ObjectId;
  user_id: string;
  first_name: string;
  last_name: string;
  user_name: string;
  email: string;
  phone: string;
  password: string;
  user_type: UserType;
  token: string;
  /**
   * Legacy single-session refresh token. New code writes `refresh_tokens`
   * instead; old docs are read through the `activeRefreshTokens` helper, which
   * falls back to this field until the user next logs in or refreshes.
   */
  refresh_token?: string;
  /** Active refresh tokens, one per signed-in device (capped, newest kept). */
  refresh_tokens: string[];
  created_at: string;
  updated_at: string;
  isDeleted: boolean;
  /** Soft lock: can still log in, but cannot register for or join tournaments. */
  isSuspended: boolean;
  /** Hard lock: logged out on every device and cannot log in or refresh. */
  isBanned?: boolean;
  emailVerified: boolean;
  verified: boolean;
  twitter: string;
  instagram: string;
  linkedin: string;
  facebook: string;
  country: string;
  location: string;
  icon: string;
  /** Tier for hosts without an org. Missing on existing users, treated as FREE. */
  plan?: Plan;
}

export interface TournamentDoc {
  _id: ObjectId;
  Name: string;
  GameName: string;
  icon: string;
  TournamentType: string;
  Payment: string;
  Currency: string;
  TournamentMode: string;
  TournamentSize: number;
  Team: string;
  Shuffle: string;
  Created_at: string;
  Updated_at: string;
  TournamentId: string;
  User_id: string;
  OrgId: string;
  OrgName: string;
  OrgIcon: string;
  OrgVerified?: boolean;
  CatalogKind?: string;
  FormatName?: string;
  RosterCount?: number;
  AllowDraw?: boolean;
  ScoreLabel?: string;
  VenueCountry?: string;
  VenueCity?: string;
  VenueLocation?: string;
  VenueLat?: number;
  VenueLng?: number;
  VenueGeo?: { type: "Point"; coordinates: [number, number] };
  Venues?: {
    Country: string;
    Location: string;
    Lat: number;
    Lng: number;
    Geo?: { type: "Point"; coordinates: [number, number] };
  }[];
  Active: boolean;
  IsDeleted: boolean;
  IsSuspended: boolean;
  Start: boolean;
  Link: string;
  Date: string;
  IsPaid: boolean;
  IsDrawn: boolean;
  RefNumber: string;
  PaymentChannel: string;
  Amount: number;
  RegistrationAmount: number;
  Prizes: PrizePosition[];
  Note: string;
  Description?: string;
  TimeZone?: string;
  /** Denormalized rating so cards and lists show it without extra queries. */
  RatingAvg?: number;
  RatingCount?: number;
  Announcements?: {
    Id: string;
    Body: string;
    CreatedAt: string;
    AuthorId: string;
  }[];
  PendingSettingChange?: {
    Id: string;
    ProposedBy: string;
    CreatedAt: string;
    Summary: string;
    Patch: Record<string, unknown>;
    RequiredUserIds: string[];
    AcceptedUserIds: string[];
  };
  AcceptedInvites: string[];
  Platform: string;
  Winner?: Teams;
  Stage: number;
  Groups: TournamentGroup[];
  PointSystem: PointSystem;
  ReturnLeg: boolean;
  Featured?: boolean;
  FeaturedAt?: string;
  Managers?: string[];
  AdvancePerGroup?: number;
  GroupCount?: number;
  OwnerCanReshuffleGroups?: boolean;
  OwnerCanAddParticipants?: boolean;
  OwnerCanSelectQualifiers?: boolean;
  Qualifiers?: {
    GroupName: string;
    TeamName: string;
    Reason: string;
    Seed: number;
  }[];
  DisqualifiedTeams?: string[];
  KnockoutFormat?: string;
  KnockoutFinalsSeries?: boolean;
  ThirdPlace?: boolean;
  TieBreaker?: string;
  BrLobbyCount?: number;
  BrKillPoints?: number;
  BrFirstBloodPoints?: number;
  BrPlacementPoints?: number[];
  RegistrationDeadline?: string;
  CheckInRequired?: boolean;
  CheckInOpens?: string;
  CheckInCloses?: string;
  FirstMatchAt?: string;
  MatchIntervalMinutes?: number;
  PlatformFeeBps?: number;
  PurseFunded?: boolean;
  PotNet?: number;
  FeeCollected?: number;
  SettlementStatus?: string;
}

export interface DrawDoc {
  _id: ObjectId;
  Team1?: Teams;
  Team2?: Teams;
  Created_at: string;
  Updated_at: string;
  TournamentId: string;
  DrawId: string;
  Stage: number;
  Winner: string;
  BRWinner: string;
  Time: string;
  Date: string;
  Team1Score: number;
  Team2Score: number;
  Link: string;
  Group: string;
  BRTeams: BRTeams[];
  Played?: boolean;
  SeriesId?: string;
  Leg?: number;
  Kind?: string;
  /**
   * Where this specific match is played. Independent of the tournament venues:
   * a host can point one fixture at a different pitch.
   */
  VenueName?: string;
  VenueCountry?: string;
  VenueLat?: number;
  VenueLng?: number;
  VenueGeo?: { type: "Point"; coordinates: [number, number] };
}

/**
 * A pending request to join an invite-only tournament. The host approves it,
 * which registers the team, or declines it. Carries the same roster payload a
 * registration would.
 */
export interface JoinRequestDoc {
  _id: ObjectId;
  JoinRequestId: string;
  TournamentId: string;
  /** The requesting captain. */
  User_id: string;
  UserName: string;
  TeamName: string;
  Players: Player[];
  Icon: string;
  Created_at: string;
}

/** A star rating and optional review, aimed at a user, an org, or a tournament. */
export interface RatingDoc {
  _id: ObjectId;
  RatingId: string;
  /** What is being rated. */
  TargetType: "USER" | "ORG" | "TOURNAMENT";
  TargetId: string;
  TargetName: string;
  /** The rater. */
  User_id: string;
  UserName: string;
  Stars: number;
  Comment: string;
  Created_at: string;
  Updated_at: string;
}

export interface RegisterTournamentDoc {
  _id: ObjectId;
  Players: Player[];
  Created_at: string;
  Updated_at: string;
  TournamentId: string;
  TournamentName: string;
  TournamentIcon: string;
  TournamentDate: string;
  RegisterTournamentId: string;
  TeamName: string;
  RefNumber: string;
  PaymentChannel: string;
  Amount: number;
  Icon: string;
  CheckedIn?: boolean;
  CheckedInAt?: string;
  /** Who registered the team. Missing on legacy docs - falls back to Players[0]. */
  CaptainUserId?: string;
}

export interface InviteTournamentDoc {
  _id: ObjectId;
  invite_id: string;
  kind: TournamentInviteKind;
  tournament_id: string;
  tournament_name: string;
  team_name: string;
  register_id: string;
  inviter_id: string;
  invitee_id: string;
  /** Legacy Go field; prefer invitee_id. */
  user_id?: string;
  status: OrgInviteStatus;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface NotificationDoc {
  _id: ObjectId;
  user_id: string;
  message: string;
  timestamp: string;
  is_read: boolean;
  kind?: NotificationKind;
  invite_id?: string;
  tournament_id?: string;
  team_id?: string;
}

export interface ContactUsDoc {
  _id: ObjectId;
  Created_at: string;
  Updated_at: string;
  ContactId: string;
  Email: string;
  Name: string;
  Message: string;
  Achived: boolean;
  IsDeleted: boolean;
  IsCompleted: boolean;
}

export interface ReportAbuseDoc {
  _id: ObjectId;
  Created_at: string;
  Updated_at: string;
  ReportAbuseId: string;
  UserID: string;
  Email: string;
  Name: string;
  Message: string;
  For: string;
  Achived: boolean;
  IsDeleted: boolean;
  IsCompleted: boolean;
  /** What the report is about. Missing on older rows, treated as OTHER. */
  Kind?: ReportKind;
  /** Set when a player raises an issue about a specific event. */
  TournamentId?: string;
  TournamentName?: string;
  /** Short category the reporter picked, e.g. "Result is wrong". */
  Reason?: string;
  /** For CONTACT_CHANGE: what the verified user is asking to change to. */
  RequestedEmail?: string;
  RequestedPhone?: string;
}

export interface OrgDoc {
  _id: ObjectId;
  org_id: string;
  name: string;
  description: string;
  image: string;
  banner: string;
  website: string;
  twitter: string;
  instagram: string;
  linkedin: string;
  facebook: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  isDeleted: boolean;
  verified: boolean;
  /** Subscription tier. Missing on existing orgs, treated as FREE. */
  plan?: Plan;
}

export interface OrgMemberDoc {
  _id: ObjectId;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface OrgInviteDoc {
  _id: ObjectId;
  invite_id: string;
  org_id: string;
  org_name: string;
  inviter_id: string;
  invitee_id: string;
  role: OrgRole;
  status: OrgInviteStatus;
  created_at: string;
  updated_at: string;
}

export interface GameDoc {
  _id: ObjectId;
  game_id: string;
  name: string;
  image: string;
  platforms: string[];
  kind?: string;
  formats?: { id: string; label: string; roster: number }[];
  allowDraw?: boolean;
  scoreLabel?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogKindDoc {
  _id: ObjectId;
  kind_id: string;
  slug: string;
  label: string;
  usesPlatforms: boolean;
  usesBattleRoyale: boolean;
  usesInGameName: boolean;
  usesVenue?: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformDoc {
  _id: ObjectId;
  platform_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A roster a player keeps on their profile and reuses across tournaments,
 * independent of any single event. Mirrors the org/orgMember/orgInvite shape.
 */
export interface SavedTeamDoc {
  _id: ObjectId;
  team_id: string;
  name: string;
  icon: string;
  captain_id: string;
  created_at: string;
  updated_at: string;
  isDeleted: boolean;
}

export interface SavedTeamMemberDoc {
  _id: ObjectId;
  team_id: string;
  user_id: string;
  role: SavedTeamRole;
  /** Remembered so entering a tournament does not re-ask for it. */
  game_user_name: string;
  created_at: string;
}

export interface SavedTeamInviteDoc {
  _id: ObjectId;
  invite_id: string;
  team_id: string;
  team_name: string;
  inviter_id: string;
  invitee_id: string;
  status: OrgInviteStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Single-document store for platform-wide settings. Keyed so future settings
 * can live alongside the fee without another collection.
 */
export interface SettingsDoc {
  _id: ObjectId;
  key: "platform";
  /** Basis points, so 1000 = 10%. Stamped onto each new tournament. */
  platformFeeBps: number;
  /**
   * Whether hosts can create paid / sponsored events right now. Turning these
   * off only stops NEW events; ones already running keep taking entries and
   * settling, so nobody is stranded mid-tournament.
   */
  paidEnabled?: boolean;
  sponsoredEnabled?: boolean;
  /** One-off tournament pricing: pay once to create a single event above the
   *  free limits, without a subscription. */
  oneOffEnabled?: boolean;
  oneOffPriceMinor?: number;
  oneOffCurrency?: string;
  oneOffTier?: Plan;
  /**
   * Per-tier limits, prices and branding flags, edited from the admin desk.
   * Missing on a deployment that has never saved them, which resolves to the
   * defaults in `@/lib/plans`.
   */
  plans?: PlanConfig;
  /** Ready-made tournament setups offered in the create wizard. */
  templates?: TournamentTemplate[];
  /** When false, any signed-in host can create a sponsored event; default true. */
  sponsorRequiresOrg?: boolean;
  /** Each rating surface can be switched off; default on (undefined = on). */
  ratingUserEnabled?: boolean;
  ratingOrgEnabled?: boolean;
  ratingTournamentEnabled?: boolean;
  updated_at: string;
  updated_by: string;
}

export type IconKind = "tournament" | "team" | "player";

export interface IconDoc {
  _id: ObjectId;
  icon_id: string;
  slug: string;
  kind: IconKind;
  name: string;
  url: string;
  gameIds: string[];
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentDoc {
  _id: ObjectId;
  payment_id: string;
  kind: "ENTRY" | "SPONSOR_FUND" | "ONE_OFF";
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  processor: "STRIPE" | "PAYSTACK";
  currency: string;
  tournamentId: string;
  userId: string;
  amount: number;
  fee: number;
  net: number;
  feeBps: number;
  processorRef: string;
  checkoutUrl: string;
  email: string;
  registration?: {
    Players: Player[];
    TeamName: string;
    Icon: string;
    /** Set when the captain paid to enter a roster saved on their profile. */
    SavedTeamId?: string;
  };
  /** For ONE_OFF: the tournament to create once this payment clears. */
  tournamentDraft?: SaveTournamentInput;
  createdTournamentId?: string;
  created_at: string;
  updated_at: string;
  paid_at: string;
}

export interface PayoutDoc {
  _id: ObjectId;
  payout_id: string;
  tournamentId: string;
  tournamentName: string;
  /** 1/2/3 for podium places, 0 for money returned to the host. */
  place: number;
  teamName: string;
  /** Who the money is owed to: the team captain, or the host for place 0. */
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  status: "OWED" | "PROCESSING" | "PAID" | "FAILED";
  note: string;
  /** Set once a transfer is attempted. */
  processor: "STRIPE" | "PAYSTACK" | "";
  transferRef: string;
  failureReason: string;
  paidBy: string;
  paid_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Where a user's prize money is sent. One per user per processor: Paystack
 * settles the African currencies against a bank account we resolve into a
 * transfer recipient, Stripe settles USD/GBP/EUR into a Connect account that
 * Stripe onboards and verifies itself.
 */
export interface PayoutAccountDoc {
  _id: ObjectId;
  account_id: string;
  user_id: string;
  processor: "STRIPE" | "PAYSTACK";
  status: "PENDING" | "VERIFIED" | "FAILED";
  /** Paystack `recipient_code`, or the Stripe connected account id. */
  recipient_code: string;
  bank_name: string;
  bank_code: string;
  /** Only the last four digits are retained; the recipient code does the work. */
  account_last4: string;
  account_name: string;
  currency: string;
  country: string;
  detail: string;
  created_at: string;
  updated_at: string;
}
