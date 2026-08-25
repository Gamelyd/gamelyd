import "server-only";
import type {
  ContactUsDoc,
  DrawDoc,
  GameDoc,
  InviteTournamentDoc,
  NotificationDoc,
  OrgDoc,
  OrgInviteDoc,
  OrgMemberDoc,
  PlatformDoc,
  RegisterTournamentDoc,
  ReportAbuseDoc,
  TournamentDoc,
  UserDoc,
} from "./documents";
import type { User } from "@/lib/schemas/user";
import type { Tournament } from "@/lib/schemas/tournament";
import type { Player, Teams, BRTeams, Draw } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import type {
  ContactUs,
  InviteTournament,
  Notification,
  ReportAbuse,
} from "@/lib/schemas/misc";
import type { Org, OrgInvite, OrgMember } from "@/lib/schemas/org";
import type { Game } from "@/lib/schemas/game";
import type { Platform } from "@/lib/schemas/platform";
import type {
  Payment,
  Shuffle,
  TeamSize,
  TournamentMode,
  TournamentType,
  UserType,
} from "@/lib/schemas/common";
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
    emailVerified: readBool(raw, ["emailVerified", "EmailVerified"]),
    twitter: readString(raw, ["twitter", "Twitter"]),
    instagram: readString(raw, ["instagram", "Instagram"]),
    linkedin: readString(raw, ["linkedin", "Linkedin"]),
    facebook: readString(raw, ["facebook", "Facebook"]),
    country: readString(raw, ["country", "Country"]),
    location: readString(raw, ["location", "Location"]),
  };
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
    icon: readString(raw, ["icon"]),
    TournamentType: readString(
      raw,
      ["TournamentType", "tournamenttype"],
      "PUBLIC",
    ) as TournamentType,
    Payment: readString(raw, ["Payment", "payment"], "FREE") as Payment,
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
    AcceptedInvites: readArray(raw, [
      "AcceptedInvites",
      "acceptedinvites",
    ]) as string[],
    Platform: readString(raw, ["Platform", "platform"]),
    Winner: serializeTeam(raw.Winner ?? raw.winner) ?? undefined,
    Stage: readNumber(raw, ["Stage", "stage"]),
    Groups: Array.isArray(raw.Groups)
      ? (raw.Groups as Tournament["Groups"])
      : Array.isArray(raw.groups)
        ? (raw.groups as Tournament["Groups"])
        : [],
    PointSystem: (raw.PointSystem as Tournament["PointSystem"]) ??
      (raw.pointsystem as Tournament["PointSystem"]) ?? {
        Win: 3,
        Draw: 1,
      },
    ReturnLeg: readBool(raw, ["ReturnLeg", "returnleg"]),
    Featured: readBool(raw, ["Featured", "featured"]),
    Managers: readArray(raw, ["Managers", "managers"]) as string[],
    Prizes: serializePrizes(raw.Prizes ?? raw.prizes),
  };
}

function serializePrizes(raw: unknown): Tournament["Prizes"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      return {
        Position: readNumber(row, ["Position", "position"]),
        Amount: readNumber(row, ["Amount", "amount"]),
      };
    })
    .filter((row) => row.Position > 0)
    .sort((a, b) => a.Position - b.Position);
}

function serializePlayer(raw: unknown): Player {
  const p = asRecord(raw);
  return {
    UserName: readString(p, ["UserName", "username"]),
    GameUserName: readString(p, ["GameUserName", "gameusername"]),
    User_id: readString(p, ["User_id", "user_id"]),
    Email: readString(p, ["Email", "email"]),
    Icon: readString(p, ["Icon", "icon"]),
  };
}

function serializeTeam(raw: unknown): Teams | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const t = asRecord(raw);
  return {
    TeamName: readString(t, ["TeamName", "teamname"]),
    Players: readArray(t, ["Players", "players"]).map(serializePlayer),
    Icon: readString(t, ["Icon", "icon"]),
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
  };
}

export function serializeRegistration(
  doc: RegisterTournamentDoc,
): RegisterTournament {
  const raw = asRecord(doc);
  return {
    _id: doc._id.toHexString(),
    Players: readArray(raw, ["Players", "players"]).map(serializePlayer),
    Created_at: readDate(raw, ["Created_at", "created_at"]),
    Updated_at: readDate(raw, ["Updated_at", "updated_at"]),
    TournamentId: readString(raw, ["TournamentId", "tournamentid"]),
    TournamentName: readString(raw, ["TournamentName", "tournamentname"]),
    TournamentIcon: readString(raw, ["TournamentIcon", "tournamenticon"]),
    TournamentDate: readDate(raw, ["TournamentDate", "tournamentdate"]),
    RegisterTournamentId:
      readString(raw, ["RegisterTournamentId", "registertournamentid"]) ||
      doc._id.toHexString(),
    TeamName: readString(raw, ["TeamName", "teamname"]),
    RefNumber: readString(raw, ["RefNumber", "refnumber"]),
    PaymentChannel: readString(raw, ["PaymentChannel", "paymentchannel"]),
    Amount: readNumber(raw, ["Amount", "amount"]),
    Icon: readString(raw, ["Icon", "icon"]),
  };
}

export function serializeNotification(doc: NotificationDoc): Notification {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeContact(doc: ContactUsDoc): ContactUs {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeReport(doc: ReportAbuseDoc): ReportAbuse {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeInvite(doc: InviteTournamentDoc): InviteTournament {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeOrg(doc: OrgDoc): Org {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeOrgMember(doc: OrgMemberDoc): OrgMember {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeOrgInvite(doc: OrgInviteDoc): OrgInvite {
  return { ...doc, _id: doc._id.toHexString() };
}

export function serializeGame(doc: GameDoc): Game {
  return {
    ...doc,
    _id: doc._id.toHexString(),
    platforms: Array.isArray(doc.platforms) ? doc.platforms : [],
  };
}

export function serializePlatform(doc: PlatformDoc): Platform {
  return { ...doc, _id: doc._id.toHexString() };
}
