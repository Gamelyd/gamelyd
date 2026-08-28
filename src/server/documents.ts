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
  refresh_token: string;
  created_at: string;
  updated_at: string;
  isDeleted: boolean;
  isSuspended: boolean;
  emailVerified: boolean;
  verified: boolean;
  twitter: string;
  instagram: string;
  linkedin: string;
  facebook: string;
  country: string;
  location: string;
  icon: string;
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
  kind: "ENTRY" | "SPONSOR_FUND";
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
  };
  created_at: string;
  updated_at: string;
  paid_at: string;
}

export interface PayoutDoc {
  _id: ObjectId;
  payout_id: string;
  tournamentId: string;
  place: number;
  teamName: string;
  amount: number;
  currency: string;
  status: "OWED" | "PAID" | "FAILED";
  note: string;
  created_at: string;
  updated_at: string;
}
