import "server-only";
import type {
  ContactUsDoc,
  CatalogKindDoc,
  DrawDoc,
  GameDoc,
  IconDoc,
  InviteTournamentDoc,
  NotificationDoc,
  OrgDoc,
  OrgInviteDoc,
  OrgMemberDoc,
  PlatformDoc,
  RegisterTournamentDoc,
  JoinRequestDoc,
  RatingDoc,
  ReportAbuseDoc,
  TournamentDoc,
  UserDoc,
} from "./documents";
import type { User } from "@/lib/schemas/user";
import type { Tournament, TournamentVenue } from "@/lib/schemas/tournament";
import type { Player, Teams, BRTeams, Draw } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { JoinRequest } from "@/lib/schemas/joinRequest";
import { ratingTargetSchema, type Rating } from "@/lib/schemas/rating";
import type {
  ContactUs,
  InviteTournament,
  Notification,
  ReportAbuse,
} from "@/lib/schemas/misc";
import type { Org, OrgInvite, OrgMember } from "@/lib/schemas/org";
import type { Game, ScoreLabel, CatalogFormat } from "@/lib/schemas/game";
import type { CatalogKind } from "@/lib/schemas/catalogKind";
import type { IconAsset } from "@/lib/schemas/icon";
import { catalogUrl } from "@/lib/icons";
import { normalizePlan, type Plan } from "@/lib/plans";
import type { Platform } from "@/lib/schemas/platform";
import type {
  Payment,
  Shuffle,
  TeamSize,
  TournamentMode,
  TournamentType,
  UserType,
  NotificationKind,
  OrgInviteStatus,
  TournamentInviteKind,
} from "@/lib/schemas/common";
import { notificationKindSchema } from "@/lib/schemas/common";
import { parseCurrency } from "@/lib/currency";
import {
  asRecord,
  readArray,
  readBool,
  readDate,
  readNumber,
  readString,
} from "./legacy";

export function serializeUser(doc: UserDoc): User {
  const raw = asRecord(doc);
  const firstName = readString(raw, ["first_name", "First_name"]);
  const lastName = readString(raw, ["last_name", "Last_name"]);
  const email = readString(raw, ["email", "Email"]);
  const userName =
    readString(raw, ["user_name", "User_name", "username"]) ||
    firstName ||
    email.split("@")[0] ||
    "player";
  return {
    _id: doc._id.toHexString(),
    user_id: readString(raw, ["user_id", "User_id"]) || doc._id.toHexString(),
    first_name: firstName,
    last_name: lastName,
    user_name: userName,
    email,
    phone: readString(raw, ["phone", "Phone"]),
    user_type: (readString(raw, ["user_type", "User_type"]) ||
      "USER") as UserType,
    token: readString(raw, ["token", "Token"]) || undefined,
    created_at: readDate(raw, ["created_at", "Created_at"]),
    updated_at: readDate(raw, ["updated_at", "Updated_at"]),
    isDeleted: readBool(raw, ["isDeleted", "IsDeleted"]),
    isSuspended: readBool(raw, ["isSuspended", "IsSuspended"]),
    isBanned: readBool(raw, ["isBanned", "IsBanned"]),
    emailVerified: readBool(raw, ["emailVerified", "EmailVerified"]),
    verified: readBool(raw, ["verified", "Verified"]),
    twitter: readString(raw, ["twitter", "Twitter"]),
    instagram: readString(raw, ["instagram", "Instagram"]),
    linkedin: readString(raw, ["linkedin", "Linkedin"]),
    facebook: readString(raw, ["facebook", "Facebook"]),
    country: readString(raw, ["country", "Country"]),
    location: readString(raw, ["location", "Location"]),
    icon: catalogUrl(readString(raw, ["icon", "Icon"])),
    plan: parsePlan(readString(raw, ["plan", "Plan"])),
  };
}

/** Retired tiers map onto a current one; anything unknown falls back to FREE. */
function parsePlan(value: string): Plan {
  return normalizePlan(value);
}

export function serializeTournament(doc: TournamentDoc): Tournament {
  return serializeTournamentCompat(doc);
}

function normalizeMode(value: string): TournamentMode {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact === "BATTLEROYALE") return "BATTLEROYALE";
  if (compact === "GROUPS") return "GROUPS";
  if (compact === "LEAGUE") return "LEAGUE";
  return "MULTIPLAYER";
}

/**
 * Maps both PascalCase (new app) and lowercase (Go/mgo) tournament documents
 * onto the public Tournament type so listings and the tournament view can
 * show legacy data.
 */
export function serializeTournamentCompat(doc: TournamentDoc): Tournament {
  const raw = asRecord(doc);
  const id =
    readString(raw, ["TournamentId", "tournamentid"]) || doc._id.toHexString();
  return {
    _id: doc._id.toHexString(),
    Name: readString(raw, ["Name", "name"]),
    GameName: readString(raw, ["GameName", "gamename"]),
    icon: catalogUrl(readString(raw, ["icon", "Icon"])),
    TournamentType: readString(
      raw,
      ["TournamentType", "tournamenttype"],
      "PUBLIC",
    ) as TournamentType,
    Payment: readString(raw, ["Payment", "payment"], "FREE") as Payment,
    Currency: parseCurrency(readString(raw, ["Currency", "currency"], "USD")),
    TournamentMode: normalizeMode(
      readString(raw, ["TournamentMode", "tournamentmode"], "MULTIPLAYER"),
    ),
    TournamentSize: readNumber(raw, ["TournamentSize", "tournamentsize"], 0),
    Team: readString(raw, ["Team", "team"], "SINGLE") as TeamSize,
    Shuffle: readString(raw, ["Shuffle", "shuffle"], "AUTOMATIC") as Shuffle,
    Created_at: readDate(raw, ["Created_at", "created_at"]),
    Updated_at: readDate(raw, ["Updated_at", "updated_at"]),
    TournamentId: id,
    User_id: readString(raw, ["User_id", "user_id"]),
    OrgId: readString(raw, ["OrgId", "orgid"]),
    OrgName: readString(raw, ["OrgName", "orgname"]),
    OrgIcon: readString(raw, ["OrgIcon", "orgicon"]),
    OrgVerified: readBool(raw, ["OrgVerified", "orgverified"]),
    CatalogKind:
      readString(raw, ["CatalogKind", "catalogkind"], "games") || "games",
    FormatName: readString(raw, ["FormatName", "formatname"]),
    RosterCount: readNumber(raw, ["RosterCount", "rostercount"]),
    AllowDraw: readBoolOr(raw, ["AllowDraw", "allowdraw"], true),
    ScoreLabel: normalizeScoreLabel(
      readString(raw, ["ScoreLabel", "scorelabel"], "Goals"),
    ),
    ...serializeVenueFields(raw),
    Active: readBool(raw, ["Active", "active"]),
    IsDeleted: readBool(raw, ["IsDeleted", "isdeleted"]),
    IsSuspended: readBool(raw, ["IsSuspended", "issuspended"]),
    Start: readBool(raw, ["Start", "start"]),
    Link: readString(raw, ["Link", "link"]),
    Date: readDate(raw, ["Date", "date"]),
    IsPaid: readBool(raw, ["IsPaid", "ispaid"]),
    IsDrawn: readBool(raw, ["IsDrawn", "isdrawn"]),
    RefNumber: readString(raw, ["RefNumber", "refnumber"]),
    PaymentChannel: readString(raw, ["PaymentChannel", "paymentchannel"]),
    Amount: readNumber(raw, ["Amount", "amount"]),
    RegistrationAmount: readNumber(raw, [
      "RegistrationAmount",
      "registrationamount",
    ]),
    Note: readString(raw, ["Note", "note"]),
    Description: readString(raw, ["Description", "description"]),
    TimeZone: readString(raw, ["TimeZone", "timezone"]),
    RatingAvg: readNumber(raw, ["RatingAvg", "ratingavg"]),
    RatingCount: readNumber(raw, ["RatingCount", "ratingcount"]),
    Announcements: serializeAnnouncements(
      raw.Announcements ?? raw.announcements,
    ),
    PendingSettingChange: serializePendingSettingChange(
      raw.PendingSettingChange ?? raw.pendingsettingchange,
    ),
    AcceptedInvites: readArray(raw, [
      "AcceptedInvites",
      "acceptedinvites",
    ]) as string[],
    Platform: readString(raw, ["Platform", "platform"]),
    Winner: serializeTeam(raw.Winner ?? raw.winner) ?? undefined,
    Stage: readNumber(raw, ["Stage", "stage"]),
    Groups: serializeGroups(raw),
    PointSystem: (raw.PointSystem as Tournament["PointSystem"]) ??
      (raw.pointsystem as Tournament["PointSystem"]) ?? {
        Win: 3,
        Draw: 1,
      },
    ReturnLeg: readBool(raw, ["ReturnLeg", "returnleg"]),
    Featured: readBool(raw, ["Featured", "featured"]),
    Managers: readArray(raw, ["Managers", "managers"]) as string[],
    AdvancePerGroup:
      readNumber(raw, ["AdvancePerGroup", "advancepergroup"]) || 2,
    GroupCount: readNumber(raw, ["GroupCount", "groupcount"]),
    OwnerCanReshuffleGroups: ownerCanReshuffleGroups(raw),
    OwnerCanAddParticipants: readBool(raw, [
      "OwnerCanAddParticipants",
      "ownercanaddparticipants",
    ]),
    OwnerCanSelectQualifiers: readBool(raw, [
      "OwnerCanSelectQualifiers",
      "ownercanselectqualifiers",
    ]),
    Qualifiers: serializeQualifiers(raw.Qualifiers ?? raw.qualifiers),
    DisqualifiedTeams: (
      readArray(raw, ["DisqualifiedTeams", "disqualifiedteams"]) as string[]
    ).filter((name) => typeof name === "string" && name.length > 0),
    Prizes: serializePrizes(raw.Prizes ?? raw.prizes),
    KnockoutFormat: (readString(
      raw,
      ["KnockoutFormat", "knockoutformat"],
      "SINGLE",
    ) || "SINGLE") as Tournament["KnockoutFormat"],
    KnockoutFinalsSeries: readBool(raw, [
      "KnockoutFinalsSeries",
      "knockoutfinalsseries",
    ]),
    ThirdPlace: readBool(raw, ["ThirdPlace", "thirdplace"]),
    TieBreaker: (readString(
      raw,
      ["TieBreaker", "tiebreaker"],
      "GOAL_DIFF",
    ) || "GOAL_DIFF") as Tournament["TieBreaker"],
    BrLobbyCount: readNumber(raw, ["BrLobbyCount", "brlobbycount"]) || 1,
    BrKillPoints: readNumber(raw, ["BrKillPoints", "brkillpoints"], 1),
    BrFirstBloodPoints: readNumber(raw, [
      "BrFirstBloodPoints",
      "brfirstbloodpoints",
    ]),
    BrPlacementPoints: serializePlacementPoints(
      raw.BrPlacementPoints ?? raw.brplacementpoints,
    ),
    RegistrationDeadline: readString(raw, [
      "RegistrationDeadline",
      "registrationdeadline",
    ]),
    CheckInRequired: readBool(raw, ["CheckInRequired", "checkinrequired"]),
    CheckInOpens: readString(raw, ["CheckInOpens", "checkinopens"]),
    CheckInCloses: readString(raw, ["CheckInCloses", "checkincloses"]),
    FirstMatchAt: readString(raw, ["FirstMatchAt", "firstmatchat"]),
    MatchIntervalMinutes: readNumber(raw, [
      "MatchIntervalMinutes",
      "matchintervalminutes",
    ]),
    PlatformFeeBps: readNumber(raw, ["PlatformFeeBps", "platformfeebps"], 1000) || 1000,
    PurseFunded: purseFunded(raw),
    PotNet: readNumber(raw, ["PotNet", "potnet"]),
    FeeCollected: readNumber(raw, ["FeeCollected", "feecollected"]),
    SettlementStatus: settlementStatus(raw),
  };
}

function purseFunded(raw: Record<string, unknown>): boolean {
  for (const key of ["PurseFunded", "pursefunded"]) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return true;
}

function settlementStatus(
  raw: Record<string, unknown>,
): Tournament["SettlementStatus"] {
  const value = readString(raw, ["SettlementStatus", "settlementstatus"], "NONE");
  if (value === "OPEN" || value === "SETTLED") return value;
  return "NONE";
}

function ownerCanReshuffleGroups(raw: Record<string, unknown>): boolean {
  for (const key of ["OwnerCanReshuffleGroups", "ownercanreshufflegroups"]) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return true;
}

function serializeAnnouncements(
  raw: unknown,
): Tournament["Announcements"] {
  if (!Array.isArray(raw)) return [];
  const out: Tournament["Announcements"] = [];
  for (const item of raw) {
    const row = asRecord(item);
    const Id = readString(row, ["Id", "id"]);
    const Body = readString(row, ["Body", "body"]).trim();
    if (!Id || !Body) continue;
    out.push({
      Id,
      Body: Body.slice(0, 2000),
      CreatedAt: readDate(row, ["CreatedAt", "createdat", "Created_at"]),
      AuthorId: readString(row, ["AuthorId", "authorid"]),
    });
  }
  out.sort((a, b) => {
    const aTime = Date.parse(a.CreatedAt);
    const bTime = Date.parse(b.CreatedAt);
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
  return out;
}

function serializePendingSettingChange(
  raw: unknown,
): Tournament["PendingSettingChange"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const row = asRecord(raw);
  const Id = readString(row, ["Id", "id"]);
  if (!Id) return undefined;
  const patchRaw = row.Patch ?? row.patch;
  const Patch =
    patchRaw && typeof patchRaw === "object" && !Array.isArray(patchRaw)
      ? (patchRaw as Record<string, unknown>)
      : {};
  return {
    Id,
    ProposedBy: readString(row, ["ProposedBy", "proposedby"]),
    CreatedAt: readDate(row, ["CreatedAt", "createdat"]),
    Summary: readString(row, ["Summary", "summary"]),
    Patch,
    RequiredUserIds: (readArray(row, [
      "RequiredUserIds",
      "requireduserids",
    ]) as string[]).filter((id) => typeof id === "string" && id.length > 0),
    AcceptedUserIds: (readArray(row, [
      "AcceptedUserIds",
      "accepteduserids",
    ]) as string[]).filter((id) => typeof id === "string" && id.length > 0),
  };
}

function serializeQualifiers(raw: unknown): Tournament["Qualifiers"] {
  if (!Array.isArray(raw)) return [];
  const out: Tournament["Qualifiers"] = [];
  for (const item of raw) {
    const row = asRecord(item);
    const GroupName = readString(row, ["GroupName", "groupname"]);
    const TeamName = readString(row, ["TeamName", "teamname"]);
    const Reason = readString(row, ["Reason", "reason"]).trim();
    const Seed = readNumber(row, ["Seed", "seed"]);
    if (!GroupName || !TeamName || Reason.length < 3 || Seed < 1) continue;
    out.push({
      GroupName,
      TeamName,
      Reason: Reason.slice(0, 280),
      Seed,
    });
  }
  return out;
}

function serializePrizes(raw: unknown): Tournament["Prizes"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      return {
        Position: readNumber(row, ["Position", "position"]),
        Amount: readNumber(row, ["Amount", "amount"]),
        Share: readNumber(row, ["Share", "share"]),
      };
    })
    .filter((row) => row.Position > 0)
    .sort((a, b) => a.Position - b.Position);
}

function serializePlacementPoints(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [12, 9, 7, 5, 4, 3, 2, 1];
  }
  return raw.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0,
  );
}

function serializePlayer(raw: unknown): Player {
  const p = asRecord(raw);
  return {
    UserName: readString(p, ["UserName", "username"]),
    GameUserName: readString(p, ["GameUserName", "gameusername"]),
    User_id: readString(p, ["User_id", "user_id"]),
    Email: readString(p, ["Email", "email"]),
    Icon: catalogUrl(readString(p, ["Icon", "icon"])),
    Verified: readBool(p, ["Verified", "verified"]),
  };
}

/**
 * Groups were the one field handed to the UI exactly as Mongo stored them,
 * while every field around them goes through the legacy-key readers. A row
 * written with `groupName`/`teams`, or with no name at all, therefore arrived
 * as `{ GroupName: undefined }` and took the tournament page down the moment
 * anything read it.
 *
 * Normalising here fixes it for every consumer at once -- the board, the
 * standings, the draw service and the downloadable images all read `GroupName`.
 */
function serializeGroups(raw: Record<string, unknown>): Tournament["Groups"] {
  const rows = readArray(raw, ["Groups", "groups"]);
  return rows.map((row, index) => {
    const group = asRecord(row);
    const name = readString(group, ["GroupName", "groupname", "Name", "name"]);
    return {
      // A group with no stored name still needs one: it is the key draws are
      // matched on, so an empty string would silently detach its fixtures.
      GroupName: name || `Group ${index + 1}`,
      Teams: readArray(group, ["Teams", "teams"])
        .map(serializeTeam)
        .filter((team): team is Teams => Boolean(team)),
    };
  });
}

function serializeTeam(raw: unknown): Teams | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const t = asRecord(raw);
  return {
    TeamName: readString(t, ["TeamName", "teamname"]),
    Players: readArray(t, ["Players", "players"]).map(serializePlayer),
    Icon: catalogUrl(readString(t, ["Icon", "icon"])),
    Points: readNumber(t, ["Points", "points"]),
    GoalsScored: readNumber(t, ["GoalsScored", "goalsscored"]),
    GoalsReceived: readNumber(t, ["GoalsReceived", "goalsreceived"]),
    GoalsDifference: readNumber(t, ["GoalsDifference", "goalsdifference"]),
  };
}

function serializeBrTeam(raw: unknown): BRTeams {
  const t = asRecord(raw);
  return {
    TeamName: readString(t, ["TeamName", "teamname"]),
    Players: readArray(t, ["Players", "players"]).map(serializePlayer),
    Wins: readNumber(t, ["Wins", "wins"]),
    Kills: readNumber(t, ["Kills", "kills"]),
    FirstBloods: readNumber(t, ["FirstBloods", "firstbloods"]),
    Placement: readNumber(t, ["Placement", "placement"]),
  };
}

export function serializeDraw(doc: DrawDoc): Draw {
  const raw = asRecord(doc);
  return {
    _id: doc._id.toHexString(),
    Team1: serializeTeam(raw.Team1 ?? raw.team1),
    Team2: serializeTeam(raw.Team2 ?? raw.team2),
    Created_at: readDate(raw, ["Created_at", "created_at"]),
    Updated_at: readDate(raw, ["Updated_at", "updated_at"]),
    TournamentId:
      readString(raw, ["TournamentId", "tournamentid"]) || doc._id.toHexString(),
    DrawId: readString(raw, ["DrawId", "drawid"]) || doc._id.toHexString(),
    Stage: readNumber(raw, ["Stage", "stage"]),
    Winner: readString(raw, ["Winner", "winner"]),
    BRWinner: readString(raw, ["BRWinner", "brwinner"]),
    Time: readString(raw, ["Time", "time"]),
    Date: readDate(raw, ["Date", "date"]),
    Team1Score: readNumber(raw, ["Team1Score", "team1score"]),
    Team2Score: readNumber(raw, ["Team2Score", "team2score"]),
    Link: readString(raw, ["Link", "link"]),
    Group: readString(raw, ["Group", "group"]),
    BRTeams: readArray(raw, ["BRTeams", "brteams"]).map(serializeBrTeam),
    Played: readBool(raw, ["Played", "played"]),
    SeriesId: readString(raw, ["SeriesId", "seriesid"]),
    Leg: readNumber(raw, ["Leg", "leg"]) || 1,
    Kind: readString(raw, ["Kind", "kind"]),
    VenueName: readString(raw, ["VenueName", "venuename"]),
    VenueCountry: readString(raw, ["VenueCountry", "venuecountry"]),
    VenueLat: readNumber(raw, ["VenueLat", "venuelat"]),
    VenueLng: readNumber(raw, ["VenueLng", "venuelng"]),
  };
}

export function serializeRegistration(
  doc: RegisterTournamentDoc,
): RegisterTournament {
  const raw = asRecord(doc);
  const players = readArray(raw, ["Players", "players"]).map(serializePlayer);
  return {
    _id: doc._id.toHexString(),
    Players: players,
    Created_at: readDate(raw, ["Created_at", "created_at"]),
    Updated_at: readDate(raw, ["Updated_at", "updated_at"]),
    TournamentId: readString(raw, ["TournamentId", "tournamentid"]),
    TournamentName: readString(raw, ["TournamentName", "tournamentname"]),
    TournamentIcon: catalogUrl(
      readString(raw, ["TournamentIcon", "tournamenticon"]),
    ),
    TournamentDate: readDate(raw, ["TournamentDate", "tournamentdate"]),
    RegisterTournamentId:
      readString(raw, ["RegisterTournamentId", "registertournamentid"]) ||
      doc._id.toHexString(),
    TeamName: readString(raw, ["TeamName", "teamname"]),
    RefNumber: readString(raw, ["RefNumber", "refnumber"]),
    PaymentChannel: readString(raw, ["PaymentChannel", "paymentchannel"]),
    Amount: readNumber(raw, ["Amount", "amount"]),
    Icon: catalogUrl(readString(raw, ["Icon", "icon"])),
    CheckedIn: readBool(raw, ["CheckedIn", "checkedin"]),
    CheckedInAt: readString(raw, ["CheckedInAt", "checkedinat"]),
    // Legacy documents predate the field; the first player was always the
    // player who registered, so that is the correct backfill.
    CaptainUserId:
      readString(raw, ["CaptainUserId", "captainuserid"]) ||
      players[0]?.User_id ||
      "",
  };
}

export function serializeRating(doc: RatingDoc): Rating {
  const raw = asRecord(doc);
  const parsedType = ratingTargetSchema.safeParse(
    readString(raw, ["TargetType", "targettype"]).toUpperCase(),
  );
  return {
    RatingId:
      readString(raw, ["RatingId", "ratingid"]) || doc._id.toHexString(),
    TargetType: parsedType.success ? parsedType.data : "TOURNAMENT",
    TargetId: readString(raw, ["TargetId", "targetid"]),
    TargetName: readString(raw, ["TargetName", "targetname"]),
    User_id: readString(raw, ["User_id", "user_id"]),
    UserName: readString(raw, ["UserName", "username"]),
    Stars: readNumber(raw, ["Stars", "stars"]),
    Comment: readString(raw, ["Comment", "comment"]),
    Created_at: readDate(raw, ["Created_at", "created_at"]),
    Updated_at: readDate(raw, ["Updated_at", "updated_at"]),
  };
}

export function serializeJoinRequest(doc: JoinRequestDoc): JoinRequest {
  const raw = asRecord(doc);
  return {
    JoinRequestId:
      readString(raw, ["JoinRequestId", "joinrequestid"]) ||
      doc._id.toHexString(),
    TournamentId: readString(raw, ["TournamentId", "tournamentid"]),
    User_id: readString(raw, ["User_id", "user_id"]),
    UserName: readString(raw, ["UserName", "username"]),
    TeamName: readString(raw, ["TeamName", "teamname"]),
    Players: readArray(raw, ["Players", "players"]).map(serializePlayer),
    Icon: catalogUrl(readString(raw, ["Icon", "icon"])),
    Created_at: readDate(raw, ["Created_at", "created_at"]),
  };
}

export function serializeNotification(doc: NotificationDoc): Notification {
  const raw = asRecord(doc);
  // Parse against the schema so new kinds only have to be added in one place.
  const parsed = notificationKindSchema.safeParse(
    readString(raw, ["kind"], "GENERIC").toUpperCase(),
  );
  const kind: NotificationKind = parsed.success ? parsed.data : "GENERIC";
  return {
    _id: doc._id.toHexString(),
    user_id: readString(raw, ["user_id"]),
    message: readString(raw, ["message"]),
    timestamp: readString(raw, ["timestamp"]),
    is_read: readBool(raw, ["is_read"]),
    kind,
    invite_id: readString(raw, ["invite_id"]),
    tournament_id: readString(raw, ["tournament_id"]),
    team_id: readString(raw, ["team_id"]),
  };
}

export function serializeContact(doc: ContactUsDoc): ContactUs {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeReport(doc: ReportAbuseDoc): ReportAbuse {
  return {
    ...doc,
    _id: doc._id.toHexString(),
    // Rows written before reports were categorised have none of these.
    Kind: doc.Kind ?? "OTHER",
    TournamentId: doc.TournamentId ?? "",
    TournamentName: doc.TournamentName ?? "",
    Reason: doc.Reason ?? "",
    RequestedEmail: doc.RequestedEmail ?? "",
    RequestedPhone: doc.RequestedPhone ?? "",
  };
}

export function serializeInvite(doc: InviteTournamentDoc): InviteTournament {
  const raw = asRecord(doc);
  const kindRaw = readString(raw, ["kind"], "TOURNAMENT").toUpperCase();
  const kind: TournamentInviteKind = kindRaw === "TEAM" ? "TEAM" : "TOURNAMENT";
  const statusRaw = readString(raw, ["status"], "PENDING").toUpperCase();
  const status: OrgInviteStatus =
    statusRaw === "ACCEPTED" || statusRaw === "DECLINED"
      ? statusRaw
      : "PENDING";
  const invitee =
    readString(raw, ["invitee_id"]) || readString(raw, ["user_id"]);
  return {
    _id: doc._id.toHexString(),
    invite_id: readString(raw, ["invite_id"]) || doc._id.toHexString(),
    kind,
    tournament_id: readString(raw, ["tournament_id"]),
    tournament_name: readString(raw, ["tournament_name"]),
    team_name: readString(raw, ["team_name"]),
    register_id: readString(raw, ["register_id"]),
    inviter_id: readString(raw, ["inviter_id"]),
    inviter_name: "",
    invitee_id: invitee,
    invitee_name: "",
    status,
    CreatedAt: readString(raw, ["CreatedAt", "created_at"]),
    UpdatedAt: readString(raw, ["UpdatedAt", "updated_at"]),
  };
}

export function serializeOrg(doc: OrgDoc): Org {
  return {
    ...doc,
    _id: doc._id.toHexString(),
    verified: Boolean(doc.verified),
    plan: parsePlan(doc.plan ?? ""),
  };
}

export function serializeOrgMember(doc: OrgMemberDoc): OrgMember {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeOrgInvite(doc: OrgInviteDoc): OrgInvite {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeGame(doc: GameDoc): Game {
  const raw = asRecord(doc);
  return {
    _id: doc._id.toHexString(),
    game_id: doc.game_id,
    name: doc.name,
    image: catalogUrl(doc.image || ""),
    platforms: Array.isArray(doc.platforms) ? doc.platforms : [],
    kind: readString(raw, ["kind"], "games") || "games",
    formats: serializeCatalogFormats(raw.formats),
    allowDraw: readBoolOr(raw, ["allowDraw"], true),
    scoreLabel: normalizeScoreLabel(readString(raw, ["scoreLabel"], "Goals")),
    active: doc.active !== false,
    created_at: doc.created_at,
    updated_at: doc.updated_at ?? "",
  };
}

export function serializeCatalogKind(doc: CatalogKindDoc): CatalogKind {
  return {
    _id: doc._id.toHexString(),
    kind_id: doc.kind_id,
    slug: doc.slug,
    label: doc.label,
    usesPlatforms: Boolean(doc.usesPlatforms),
    usesBattleRoyale: Boolean(doc.usesBattleRoyale),
    usesInGameName: Boolean(doc.usesInGameName),
    usesVenue:
      typeof doc.usesVenue === "boolean"
        ? doc.usesVenue
        : doc.slug === "sports",
    sort: typeof doc.sort === "number" ? doc.sort : 0,
    created_at: doc.created_at,
    updated_at: doc.updated_at ?? "",
  };
}

function readBoolOr(
  raw: Record<string, unknown>,
  keys: string[],
  fallback: boolean,
): boolean {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return fallback;
}

function normalizeScoreLabel(value: string): ScoreLabel {
  return value === "Points" ? "Points" : "Goals";
}

function serializeVenueFields(raw: Record<string, unknown>): {
  VenueCountry: string;
  VenueCity: string;
  VenueLocation: string;
  VenueLat: number;
  VenueLng: number;
  Venues: TournamentVenue[];
} {
  const fromArray = Array.isArray(raw.Venues)
    ? raw.Venues
    : Array.isArray(raw.venues)
      ? raw.venues
      : [];
  const venues = fromArray
    .map((row) => {
      const rec = asRecord(row);
      const country = readString(rec, ["country", "Country"]).toUpperCase();
      const location = readString(rec, ["location", "Location"]);
      if (!location) return null;
      return {
        country,
        location,
        lat: readNumber(rec, ["lat", "Lat"]),
        lng: readNumber(rec, ["lng", "Lng"]),
      } satisfies TournamentVenue;
    })
    .filter((row): row is TournamentVenue => row !== null);
  const country = readString(raw, ["VenueCountry", "venuecountry"]).toUpperCase();
  const city = readString(raw, ["VenueCity", "venuecity"]);
  const legacyPlace = readString(raw, ["VenueLocation", "venuelocation"]);
  const eventCity = city || (venues.length === 0 ? legacyPlace : "");
  return {
    Venues: venues,
    VenueCountry: country,
    VenueCity: eventCity,
    VenueLocation: eventCity,
    VenueLat: readNumber(raw, ["VenueLat", "venuelat"]),
    VenueLng: readNumber(raw, ["VenueLng", "venuelng"]),
  };
}

function serializeCatalogFormats(raw: unknown): CatalogFormat[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const rec = asRecord(row);
      const label = readString(rec, ["label", "Label"]);
      const roster = readNumber(rec, ["roster", "Roster"]);
      const id = readString(rec, ["id", "Id"]) || label;
      if (!label || roster < 1) return null;
      return { id, label, roster };
    })
    .filter((row): row is CatalogFormat => row !== null);
}

export function serializeIcon(doc: IconDoc): IconAsset {
  return {
    _id: doc._id.toHexString(),
    icon_id: doc.icon_id,
    slug: doc.slug,
    kind: doc.kind,
    name: doc.name,
    url: catalogUrl(doc.url, doc.slug),
    gameIds: Array.isArray(doc.gameIds) ? doc.gameIds : [],
    archived: Boolean(doc.archived),
    created_at: doc.created_at,
    updated_at: doc.updated_at ?? "",
  };
}

export function serializePlatform(doc: PlatformDoc): Platform {
  return { ...doc, _id: doc._id.toHexString() };
}
