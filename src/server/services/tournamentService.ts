import "server-only";
import { ObjectId } from "mongodb";
import { draws, orgMembers, registrations, tournaments, invites, users } from "../db";
import type {
  DrawDoc,
  RegisterTournamentDoc,
  TournamentDoc,
} from "../documents";
import {
  serializeDraw,
  serializeRegistration,
  serializeTournament,
} from "../serialize";
import {
  asDocFilter,
  asRecord,
  byAnyTournamentId,
  byPlayerUserId,
  byTeamName,
  byTournamentId,
  byUserId,
  notDeleted,
  readString,
} from "../legacy";
import { ServiceError, getUserById } from "./userService";
import { getMembership, getOrgById, isMember } from "./orgService";
import { createNotification } from "./notificationService";
import { sendEmail } from "../email/mailer";
import {
  createTournamentEmail,
  registerTournamentEmail,
  tournamentInviteEmail,
} from "../email/templates";
import type { Tournament } from "@/lib/schemas/tournament";
import { browseStatusClause } from "@/lib/tournamentStatus";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Player, Teams, Draw } from "@/lib/schemas/draw";
import type {
  AdminAddParticipantsInput,
  SetGroupQualifiersInput,
  TournamentGroup,
  TournamentManager,
} from "@/lib/schemas/tournament";
import type { Paginated } from "@/lib/result";
import type {
  EditTournamentInput,
  SaveTournamentInput,
  SetGroupsInput,
  UpdateTournamentInput,
} from "@/lib/schemas/tournament";
import type { RegisterTournamentInput } from "@/lib/schemas/register";
import { rosterSize } from "@/lib/schemas/common";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
} from "@/lib/groupQualifiers";
import { computeLeagueStandings, standingToTeam } from "@/lib/leagueStandings";
import { checkInWindowOpen, registrationDeadlinePassed } from "@/lib/tournamentWindow";
import { FALLBACKS } from "@/lib/icons";
import { playerIconForUser } from "@/server/services/iconService";

const PER_PAGE = 10;

export async function saveTournament(
  uid: string,
  input: SaveTournamentInput,
): Promise<Tournament> {
  const col = await tournaments();
  const now = new Date().toISOString();
  const _id = new ObjectId();

  // If hosting under an org, the caller must be a member of it.
  let orgId = "";
  let orgName = "";
  let orgIcon = "";
  if (input.OrgId) {
    const membership = await getMembership(input.OrgId, uid);
    if (!membership) {
      throw new ServiceError("You are not a member of that organization");
    }
    const org = await getOrgById(input.OrgId);
    if (!org) throw new ServiceError("Organization not found");
    orgId = org.org_id;
    orgName = org.name;
    orgIcon = org.image;
  }

  const doc: TournamentDoc = {
    _id,
    Name: input.Name,
    GameName: input.GameName,
    icon: input.icon,
    TournamentType: input.TournamentType,
    Payment: input.Payment,
    TournamentMode: input.TournamentMode,
    TournamentSize: input.TournamentSize,
    Team: input.Team,
    Shuffle: input.Shuffle,
    Created_at: now,
    Updated_at: now,
    TournamentId: _id.toHexString(),
    User_id: uid,
    OrgId: orgId,
    OrgName: orgName,
    OrgIcon: orgIcon,
    Active: true,
    IsDeleted: false,
    IsSuspended: false,
    Start: false,
    Link: input.Link,
    Date: input.Date,
    IsPaid: input.Payment === "PAID",
    IsDrawn: false,
    RefNumber: input.RefNumber,
    PaymentChannel: input.PaymentChannel,
    Amount:
      input.Payment === "SPONSORED" && input.Prizes?.length
        ? input.Prizes.reduce((sum, prize) => sum + (prize.Amount || 0), 0)
        : input.Amount,
    RegistrationAmount:
      input.Payment === "PAID" ? input.RegistrationAmount : 0,
    Prizes: input.Payment === "SPONSORED" ? (input.Prizes ?? []) : [],
    Note: input.Note,
    AcceptedInvites: [],
    Platform: input.Platform,
    Stage: 0,
    Groups: [],
    PointSystem: {
      Win: input.PointSystem?.Win ?? 3,
      Draw: input.PointSystem?.Draw ?? 1,
    },
    ReturnLeg:
      input.TournamentMode === "LEAGUE" || input.TournamentMode === "GROUPS"
        ? Boolean(input.ReturnLeg)
        : false,
    Featured: false,
    Managers: [],
    OwnerCanReshuffleGroups: true,
    OwnerCanAddParticipants: false,
    OwnerCanSelectQualifiers:
      input.TournamentMode === "GROUPS"
        ? Boolean(input.OwnerCanSelectQualifiers)
        : false,
    Qualifiers: [],
    DisqualifiedTeams: [],
    AdvancePerGroup:
      input.TournamentMode === "GROUPS" ? input.AdvancePerGroup || 2 : 2,
    GroupCount: input.TournamentMode === "GROUPS" ? input.GroupCount || 0 : 0,
    KnockoutFormat:
      input.TournamentMode === "MULTIPLAYER" ||
      input.TournamentMode === "GROUPS"
        ? input.KnockoutFormat || "SINGLE"
        : "SINGLE",
    ThirdPlace:
      input.TournamentMode === "MULTIPLAYER" ||
      input.TournamentMode === "GROUPS"
        ? Boolean(input.ThirdPlace)
        : false,
    TieBreaker:
      input.TournamentMode === "LEAGUE" || input.TournamentMode === "GROUPS"
        ? input.TieBreaker || "GOAL_DIFF"
        : "GOAL_DIFF",
    BrLobbyCount:
      input.TournamentMode === "BATTLEROYALE" ? input.BrLobbyCount || 1 : 1,
    BrKillPoints:
      input.TournamentMode === "BATTLEROYALE" ? (input.BrKillPoints ?? 1) : 1,
    BrFirstBloodPoints:
      input.TournamentMode === "BATTLEROYALE"
        ? (input.BrFirstBloodPoints ?? 0)
        : 0,
    BrPlacementPoints:
      input.TournamentMode === "BATTLEROYALE"
        ? input.BrPlacementPoints?.length
          ? input.BrPlacementPoints
          : [12, 9, 7, 5, 4, 3, 2, 1]
        : [12, 9, 7, 5, 4, 3, 2, 1],
    RegistrationDeadline: input.RegistrationDeadline || "",
    CheckInRequired: Boolean(input.CheckInRequired),
    CheckInOpens: input.CheckInOpens || "",
    CheckInCloses: input.CheckInCloses || "",
    FirstMatchAt: input.FirstMatchAt || "",
    MatchIntervalMinutes: input.MatchIntervalMinutes || 0,
  };

  await col.insertOne(doc);

  const owner = await getUserById(uid);
  if (owner) void sendEmail(owner.email, createTournamentEmail(owner.first_name));

  return serializeTournament(doc);
}

export async function getTournamentById(
  tournamentId: string,
): Promise<Tournament | null> {
  const found = await findByAnyId(tournamentId);
  return found ? serializeTournament(found) : null;
}

export async function getPublicTournaments(
  search: string,
  page: number,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const safePage = Math.max(page, 1);
  const regex = { $regex: search, $options: "i" };
  const filter = asDocFilter<TournamentDoc>({
    $and: [
      {
        $or: [{ TournamentType: "PUBLIC" }, { tournamenttype: "PUBLIC" }],
      },
      notDeleted(),
      ...(search.trim().length > 0
        ? [
            {
              $or: [
                { Name: regex },
                { name: regex },
                { GameName: regex },
                { gamename: regex },
              ],
            },
          ]
        : []),
    ],
  });

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * PER_PAGE)
    .limit(PER_PAGE)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / PER_PAGE), 1),
    items: docs.map(serializeTournament),
  };
}

export async function getTournamentsByMode(
  payment: string,
  type: string,
  page: number,
  status = "ALL",
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const perPage = 15;
  const safePage = Math.max(page, 1);
  const clauses: Record<string, unknown>[] = [notDeleted()];
  if (payment && payment.toUpperCase() !== "ALL") {
    clauses.push({ $or: [{ Payment: payment }, { payment: payment }] });
  }
  if (type && type.toUpperCase() !== "ALL") {
    clauses.push({
      $or: [{ TournamentMode: type }, { tournamentmode: type }],
    });
  }
  const statusClause = browseStatusClause(status);
  if (statusClause) clauses.push(statusClause);

  const filter = asDocFilter<TournamentDoc>({ $and: clauses });

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeTournament),
  };
}

export async function getTournamentsByModeLimit(
  payment: string,
): Promise<Tournament[]> {
  const col = await tournaments();
  const docs = await col
    .find(
      asDocFilter<TournamentDoc>({
        $and: [
          { $or: [{ Payment: payment }, { payment: payment }] },
          notDeleted(),
        ],
      }),
    )
    .sort({ _id: -1 })
    .limit(10)
    .toArray();
  return docs.map(serializeTournament);
}

const BANNER_SLOTS = 2;

export async function getBannerTournaments(): Promise<Tournament[]> {
  const col = await tournaments();
  const docs = await col
    .find(
      asDocFilter<TournamentDoc>({
        $and: [
          { $or: [{ Featured: true }, { featured: true }] },
          notDeleted(),
          { IsSuspended: { $ne: true } },
          { issuspended: { $ne: true } },
        ],
      }),
    )
    .sort({ FeaturedAt: -1, _id: -1 })
    .limit(BANNER_SLOTS)
    .toArray();
  return docs.map(serializeTournament);
}

export async function adminToggleFeaturedTournament(id: string): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const current = serializeTournament(found);
  const next = !current.Featured;
  const now = new Date().toISOString();

  if (next) {
    const featured = await col
      .find(
        asDocFilter<TournamentDoc>({
          $and: [
            { $or: [{ Featured: true }, { featured: true }] },
            { _id: { $ne: found._id } },
          ],
        }),
      )
      .sort({ FeaturedAt: 1, _id: 1 })
      .toArray();
    const overflow = featured.slice(0, Math.max(featured.length - (BANNER_SLOTS - 1), 0));
    for (const extra of overflow) {
      await col.updateOne(
        { _id: extra._id },
        {
          $set: {
            Featured: false,
            featured: false,
            FeaturedAt: "",
            featuredAt: "",
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof col.updateOne>[1],
      );
    }
  }

  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Featured: next,
        featured: next,
        FeaturedAt: next ? now : "",
        featuredAt: next ? now : "",
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function listUserTournaments(
  userId: string,
  page: number,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const perPage = 9;
  const safePage = Math.max(page, 1);
  const filter = asDocFilter<TournamentDoc>(byUserId(userId));

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeTournament),
  };
}

export async function listUserTournamentsLimit(
  userId: string,
  limit = 7,
): Promise<Tournament[]> {
  const col = await tournaments();
  const docs = await col
    .find(asDocFilter<TournamentDoc>(byUserId(userId)))
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
  return docs.map(serializeTournament);
}

export async function listTournamentsAdmin(
  search: string,
  page: number,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const perPage = 20;
  const safePage = Math.max(page, 1);
  const regex = { $regex: search.trim(), $options: "i" };
  const filter = asDocFilter<TournamentDoc>(
    search.trim().length > 0
      ? {
          $or: [
            { Name: regex },
            { name: regex },
            { GameName: regex },
            { gamename: regex },
          ],
        }
      : {},
  );

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeTournament),
  };
}

export async function adminToggleDeleteTournament(id: string): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const next = !serializeTournament(found).IsDeleted;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsDeleted: next,
        isdeleted: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function adminResetTournament(id: string): Promise<{
  tournament: Tournament;
  deletedDraws: number;
}> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");

  const ids = relatedIdsFromDoc(found);
  const dCol = await draws();
  const deleted = await dCol.deleteMany(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Start: false,
        start: false,
        IsDrawn: false,
        isdrawn: false,
        Stage: 0,
        stage: 0,
        Active: false,
        active: false,
        Groups: [],
        groups: [],
        Qualifiers: [],
        qualifiers: [],
        DisqualifiedTeams: [],
        disqualifiedteams: [],
        Updated_at: now,
        updated_at: now,
      },
      $unset: {
        Winner: 1,
        winner: 1,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  const updated = await col.findOne({ _id: found._id });
  if (!updated) throw new ServiceError("Tournament not found");
  return {
    tournament: serializeTournament(updated),
    deletedDraws: deleted.deletedCount,
  };
}

export async function adminToggleSuspendTournament(id: string): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const next = !serializeTournament(found).IsSuspended;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsSuspended: next,
        issuspended: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function userRegisteredTournaments(
  userId: string,
  page: number,
): Promise<Paginated<RegisterTournament>> {
  const col = await registrations();
  const perPage = 9;
  const safePage = Math.max(page, 1);
  const filter = asDocFilter<RegisterTournamentDoc>(byPlayerUserId(userId));

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeRegistration),
  };
}

export async function userRegisteredTournamentsLimit(
  userId: string,
): Promise<RegisterTournament[]> {
  const col = await registrations();
  const docs = await col
    .find(asDocFilter<RegisterTournamentDoc>(byPlayerUserId(userId)))
    .sort({ _id: -1 })
    .limit(6)
    .toArray();
  return docs.map(serializeRegistration);
}

export async function registerForTournament(
  tournamentId: string,
  input: RegisterTournamentInput,
  options?: { allowPartialRoster?: boolean; autoCheckIn?: boolean },
): Promise<RegisterTournament> {
  const tournamentDoc = await findByAnyId(tournamentId);
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  if (tournament.IsDeleted) {
    throw new ServiceError("This tournament is no longer available");
  }
  if (tournament.IsSuspended) {
    throw new ServiceError("This tournament is suspended");
  }
  if (tournament.Start) {
    throw new ServiceError(
      "Registration is closed. This tournament has already started.",
    );
  }
  if (registrationDeadlinePassed(tournament.RegistrationDeadline)) {
    throw new ServiceError("Registration has closed for this tournament");
  }

  const needed = rosterSize(tournament.Team);
  if (input.Players.length < 1 || input.Players.length > needed) {
    throw new ServiceError(
      `A ${tournament.Team.toLowerCase()} team can have at most ${needed} player${needed === 1 ? "" : "s"}`,
    );
  }
  if (!options?.allowPartialRoster && input.Players.length !== needed) {
    throw new ServiceError(
      `This ${tournament.Team.toLowerCase()} tournament requires exactly ${needed} player${needed === 1 ? "" : "s"}`,
    );
  }

  const rCol = await registrations();

  const teamTaken = await rCol.countDocuments(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byTournamentId(tournament.TournamentId), byTeamName(input.TeamName)],
    }),
  );
  if (teamTaken > 0) throw new ServiceError("Team name already registered");

  for (const player of input.Players) {
    const playerTaken = await rCol.countDocuments(
      asDocFilter<RegisterTournamentDoc>({
        $and: [
          byTournamentId(tournament.TournamentId),
          byPlayerUserId(player.User_id),
        ],
      }),
    );
    if (playerTaken > 0) {
      throw new ServiceError(`${player.UserName} is already registered`);
    }
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: RegisterTournamentDoc = {
    _id,
    Players: input.Players,
    Created_at: now,
    Updated_at: now,
    TournamentId: tournament.TournamentId,
    TournamentName: tournament.Name,
    TournamentIcon: tournament.icon,
    TournamentDate: tournament.Date,
    RegisterTournamentId: _id.toHexString(),
    TeamName: input.TeamName,
    RefNumber: input.RefNumber,
    PaymentChannel: input.PaymentChannel,
    Amount: input.Amount,
    Icon: input.Icon,
    CheckedIn: !tournament.CheckInRequired || Boolean(options?.autoCheckIn),
    CheckedInAt:
      !tournament.CheckInRequired || options?.autoCheckIn ? now : "",
  };

  await rCol.insertOne(doc);

  for (const player of input.Players) {
    if (player.Email) {
      void sendEmail(
        player.Email,
        registerTournamentEmail(
          player.UserName,
          tournament.Name,
          input.TeamName,
          tournament.Date,
          tournamentId,
        ),
      );
    }
  }

  return serializeRegistration(doc);
}

/**
 * Host/admin: add existing users as a new team, or onto a team that
 * still has roster spots. Roster may be filled later up to the event size.
 */
export async function adminAddParticipants(
  uid: string,
  tournamentId: string,
  input: AdminAddParticipantsInput,
): Promise<RegisterTournament> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManuallyAddParticipants(uid, found))) {
    throw new ServiceError(
      serializeTournament(found).OwnerCanAddParticipants
        ? "You are not allowed to add players to this tournament"
        : "Only an admin can add players for this tournament",
    );
  }
  const uniqueIds = [...new Set(input.userIds)];
  if (uniqueIds.length !== input.userIds.length) {
    throw new ServiceError("Each player can only be added once");
  }

  const foundUsers = await Promise.all(uniqueIds.map((id) => getUserById(id)));
  const missing = uniqueIds.filter((_, i) => !foundUsers[i]);
  if (missing.length > 0) {
    throw new ServiceError("One or more users were not found");
  }
  const users = foundUsers.filter((u): u is NonNullable<typeof u> => Boolean(u));
  const players = await Promise.all(
    users.map(async (u) => ({
      UserName: u.user_name || u.first_name || "Player",
      GameUserName: "",
      User_id: u.user_id,
      Email: u.email || "",
      Icon: await playerIconForUser(u.user_id),
    })),
  );

  const existingName = input.existingTeamName?.trim() ?? "";
  if (existingName) {
    return addPlayersToExistingTeam(found, existingName, players);
  }

  const tournament = serializeTournament(found);
  const needed = rosterSize(tournament.Team);
  if (players.length > needed) {
    throw new ServiceError(
      `A ${tournament.Team.toLowerCase()} team can have at most ${needed} players`,
    );
  }

  const teamName =
    input.teamName?.trim() ||
    (users.length === 1
      ? users[0].user_name
      : users.map((u) => u.user_name).join(" / "));

  return registerForTournament(
    tournamentId,
    {
      TeamName: teamName,
      Icon: FALLBACKS.team,
      Players: players,
      RefNumber: "",
      PaymentChannel: "",
      Amount: 0,
    },
    { allowPartialRoster: true, autoCheckIn: true },
  );
}

async function addPlayersToExistingTeam(
  found: TournamentDoc,
  teamName: string,
  newcomers: Player[],
): Promise<RegisterTournament> {
  const tournament = serializeTournament(found);
  if (tournament.Start) {
    throw new ServiceError(
      "Registration is closed. This tournament has already started.",
    );
  }
  const needed = rosterSize(tournament.Team);
  const ids = relatedIdsFromDoc(found);
  const rCol = await registrations();
  const reg = await rCol.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byTeamName(teamName)],
    }),
  );
  if (!reg) throw new ServiceError("Team not found");

  const mapped = serializeRegistration(reg);
  const already = new Set(mapped.Players.map((p) => p.User_id));
  for (const player of newcomers) {
    if (already.has(player.User_id)) {
      throw new ServiceError(`${player.UserName} is already on this team`);
    }
    const elsewhere = await rCol.countDocuments(
      asDocFilter<RegisterTournamentDoc>({
        $and: [byAnyTournamentId(ids), byPlayerUserId(player.User_id)],
      }),
    );
    if (elsewhere > 0) {
      throw new ServiceError(`${player.UserName} is already registered`);
    }
  }

  const nextPlayers = [...mapped.Players, ...newcomers];
  if (nextPlayers.length > needed) {
    throw new ServiceError(
      `This ${tournament.Team.toLowerCase()} team only has ${Math.max(
        needed - mapped.Players.length,
        0,
      )} spot${needed - mapped.Players.length === 1 ? "" : "s"} left`,
    );
  }

  const now = new Date().toISOString();
  await rCol.updateOne(
    { _id: reg._id },
    { $set: { Players: nextPlayers, Updated_at: now } },
  );
  return serializeRegistration({
    ...reg,
    Players: nextPlayers,
    Updated_at: now,
  });
}

export async function adminSetOwnerCanReshuffleGroups(
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        OwnerCanReshuffleGroups: enabled,
        ownercanreshufflegroups: enabled,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return enabled;
}

export async function adminSetOwnerCanAddParticipants(
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        OwnerCanAddParticipants: enabled,
        ownercanaddparticipants: enabled,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return enabled;
}

export async function adminSetOwnerCanSelectQualifiers(
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        OwnerCanSelectQualifiers: enabled,
        ownercanselectqualifiers: enabled,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return enabled;
}

export async function listParticipants(
  tournamentId: string,
): Promise<RegisterTournament[]> {
  const col = await registrations();
  const ids = await relatedTournamentIds(tournamentId);
  const docs = await col
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .limit(1000)
    .toArray();
  return docs.map(serializeRegistration);
}

export async function inviteUser(
  actorUid: string,
  userId: string,
  tournamentId: string,
): Promise<void> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const tournament = serializeTournament(found);
  const invitee = await getUserById(userId);
  if (!invitee) throw new ServiceError("User not found");

  const iCol = await invites();
  const now = new Date().toISOString();
  await iCol.insertOne({
    _id: new ObjectId(),
    tournament_id: tournamentId,
    user_id: userId,
    CreatedAt: now,
    UpdatedAt: now,
  });

  await createNotification(
    userId,
    `You have been invited to ${tournament.Name}`,
  );
  void sendEmail(
    invitee.email,
    tournamentInviteEmail(invitee.first_name, tournamentId, tournament.Name),
  );
}

export async function acceptInvite(
  userId: string,
  tournamentId: string,
): Promise<void> {
  const col = await tournaments();
  await col.updateOne(asDocFilter<TournamentDoc>(byTournamentId(tournamentId)), {
    $addToSet: { AcceptedInvites: userId },
  });
}

export async function removeUserFromTournament(
  actorUid: string,
  userId: string,
  tournamentId: string,
): Promise<Player[]> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(found);
  if (tournament.Start) {
    throw new ServiceError(
      "This tournament has started. Disqualify the team instead.",
    );
  }
  if (
    actorUid !== userId &&
    !(await canAdministerTournament(actorUid, found))
  ) {
    throw new ServiceError("Only the tournament owner can remove a player");
  }

  const col = await registrations();
  const ids = relatedIdsFromDoc(found);
  const reg = await col.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byPlayerUserId(userId)],
    }),
  );
  if (!reg) return [];

  const mapped = serializeRegistration(reg);
  const remaining = mapped.Players.filter((p) => p.User_id !== userId);
  if (remaining.length === 0) {
    await col.deleteOne({ _id: reg._id });
    const groups = (tournament.Groups ?? []).map((group) => ({
      ...group,
      Teams: group.Teams.filter((team) => team.TeamName !== mapped.TeamName),
    }));
    const now = new Date().toISOString();
    const tCol = await tournaments();
    await tCol.updateOne(
      { _id: found._id },
      {
        $set: {
          Groups: groups,
          groups,
          Updated_at: now,
          updated_at: now,
        },
      } as unknown as Parameters<typeof tCol.updateOne>[1],
    );
  } else {
    await col.updateOne(
      { _id: reg._id },
      { $set: { Players: remaining, Updated_at: new Date().toISOString() } },
    );
  }
  return remaining;
}

export async function canManuallyAddParticipants(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  const t = serializeTournament(doc);
  if (t.User_id !== uid) return false;
  return t.OwnerCanAddParticipants;
}

/**
 * True if the user can drag teams between groups before fixtures are drawn.
 * Platform admins always can. Owners and co-managers can only when the
 * admin has left OwnerCanReshuffleGroups on.
 */
export async function canReshuffleGroups(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  if (!serializeTournament(doc).OwnerCanReshuffleGroups) return false;
  return canManageTournament(uid, doc);
}

/**
 * True if the user can run the tournament: the creator, a platform admin, or
 * a co-manager the owner added.
 */
export async function canManageTournament(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  const t = serializeTournament(doc);
  if (t.User_id === uid) return true;
  return t.Managers.includes(uid);
}

export async function canManageTournamentById(
  uid: string,
  tournamentId: string,
): Promise<boolean> {
  const found = await findByAnyId(tournamentId);
  if (!found) return false;
  return canManageTournament(uid, found);
}

/**
 * True if the user owns the tournament or is a platform admin. Co-managers are
 * NOT included — only these two can manage co-managers or delete/suspend.
 */
export async function canAdministerTournament(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  return serializeTournament(doc).User_id === uid;
}

export async function canAdministerTournamentById(
  uid: string,
  tournamentId: string,
): Promise<boolean> {
  const found = await findByAnyId(tournamentId);
  if (!found) return false;
  return canAdministerTournament(uid, found);
}

/**
 * Owner or platform admin, and only when the admin has turned this on for
 * the tournament. Co-managers cannot pick qualifiers.
 */
export async function canSelectGroupQualifiers(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  if (!serializeTournament(doc).OwnerCanSelectQualifiers) return false;
  return canAdministerTournament(uid, doc);
}

export async function setGroupQualifiers(
  uid: string,
  tournamentId: string,
  input: SetGroupQualifiersInput,
): Promise<SetGroupQualifiersInput["Qualifiers"]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(found);

  if (tournament.TournamentMode !== "GROUPS") {
    throw new ServiceError("This tournament is not a group tournament");
  }
  if (!tournament.OwnerCanSelectQualifiers) {
    throw new ServiceError(
      "Selecting qualifiers is not enabled for this tournament",
    );
  }
  if (!(await canSelectGroupQualifiers(uid, found))) {
    throw new ServiceError("Only the tournament owner can select who qualifies");
  }
  if (!tournament.Groups || tournament.Groups.length === 0) {
    throw new ServiceError("This tournament has no groups");
  }

  const ids = relatedIdsFromDoc(found);
  const dCol = await draws();
  const allDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  const groupDraws = allDraws.filter((d) => d.Group);
  if (groupDraws.length === 0) {
    throw new ServiceError("Draw the group fixtures first");
  }
  if (groupDraws.some((d) => !d.Played)) {
    throw new ServiceError("Record every group result before selecting qualifiers");
  }
  const knockoutDraws = allDraws.filter(
    (d) => !d.Group && d.BRTeams.length === 0,
  );
  if (knockoutDraws.length > 0) {
    throw new ServiceError("The knockout stage has already been drawn");
  }

  const advancePerGroup = tournament.AdvancePerGroup || 2;
  const disqualified = asDisqualifiedSet(tournament.DisqualifiedTeams);
  const sections = tournament.Groups.map((group) => ({
    name: group.GroupName,
    standings: computeLeagueStandings(
      group.Teams,
      groupDraws.filter((d) => d.Group === group.GroupName),
      tournament.PointSystem,
      tournament.TieBreaker,
    ),
  }));

  const groupNames = new Set(tournament.Groups.map((g) => g.GroupName));
  for (const pick of input.Qualifiers) {
    if (!groupNames.has(pick.GroupName)) {
      throw new ServiceError(`Unknown group ${pick.GroupName}`);
    }
  }

  if (
    !groupQualifiersComplete(
      sections,
      input.Qualifiers,
      advancePerGroup,
      disqualified,
      true,
    )
  ) {
    throw new ServiceError(
      "Pick who goes through from each points tie, and add a public reason",
    );
  }

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Qualifiers: input.Qualifiers,
        qualifiers: input.Qualifiers,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return input.Qualifiers;
}

export async function disqualifyTeam(
  uid: string,
  tournamentId: string,
  teamName: string,
): Promise<{ tournament: Tournament; forfeited: number; draws: Draw[] }> {
  const trimmed = teamName.trim();
  if (!trimmed) throw new ServiceError("Team is required");

  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(uid, found))) {
    throw new ServiceError("Only the tournament owner can disqualify a team");
  }

  const tournament = serializeTournament(found);
  const already = asDisqualifiedSet(tournament.DisqualifiedTeams);
  if (already.has(trimmed)) {
    throw new ServiceError("This team is already disqualified");
  }

  const ids = relatedIdsFromDoc(found);
  const dCol = await draws();
  const drawDocs = await dCol
    .find(asDocFilter<DrawDoc>(byAnyTournamentId(ids)))
    .toArray();

  const now = new Date().toISOString();
  let forfeited = 0;
  for (const doc of drawDocs) {
    const draw = serializeDraw(doc);
    if (draw.Played) continue;
    const t1 = draw.Team1?.TeamName;
    const t2 = draw.Team2?.TeamName;
    const isBr = (draw.BRTeams?.length ?? 0) > 0;

    if (isBr) {
      const nextBr = draw.BRTeams.filter((t) => t.TeamName !== trimmed);
      if (nextBr.length === draw.BRTeams.length) continue;
      await dCol.updateOne(
        { _id: doc._id },
        {
          $set: {
            BRTeams: nextBr,
            brteams: nextBr,
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof dCol.updateOne>[1],
      );
      forfeited += 1;
      continue;
    }

    if (t1 === trimmed && t2) {
      await dCol.updateOne(
        { _id: doc._id },
        {
          $set: {
            Team1Score: 0,
            Team2Score: 3,
            Winner: "Team2",
            winner: "Team2",
            Played: true,
            played: true,
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof dCol.updateOne>[1],
      );
      forfeited += 1;
    } else if (t2 === trimmed && t1) {
      await dCol.updateOne(
        { _id: doc._id },
        {
          $set: {
            Team1Score: 3,
            Team2Score: 0,
            Winner: "Team1",
            winner: "Team1",
            Played: true,
            played: true,
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof dCol.updateOne>[1],
      );
      forfeited += 1;
    }
  }

  const nextDq = [...tournament.DisqualifiedTeams, trimmed];
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        DisqualifiedTeams: nextDq,
        disqualifiedteams: nextDq,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  if (tournament.TournamentMode === "LEAGUE") {
    const leagueDraws = (
      await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
    ).map(serializeDraw);
    if (
      leagueDraws.length > 0 &&
      leagueDraws.every((d) => d.Played) &&
      leagueDraws.every((d) => d.BRTeams.length === 0)
    ) {
      const teams = leagueDraws.flatMap((item) =>
        [item.Team1, item.Team2].filter((team): team is Teams => Boolean(team)),
      );
      const unique = [
        ...new Map(teams.map((team) => [team.TeamName, team])).values(),
      ];
      const table = computeLeagueStandings(
        unique,
        leagueDraws,
        tournament.PointSystem,
        tournament.TieBreaker,
      ).filter((row) => row.TeamName !== trimmed);
      const leader = table[0];
      if (leader) {
        await col.updateOne(
          { _id: found._id },
          {
            $set: {
              Winner: standingToTeam(leader),
              winner: standingToTeam(leader),
              Active: false,
              active: false,
            },
          } as unknown as Parameters<typeof col.updateOne>[1],
        );
      }
    }
  }

  const updated = await col.findOne({ _id: found._id });
  if (!updated) throw new ServiceError("Tournament not found");
  const updatedDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  return {
    tournament: serializeTournament(updated),
    forfeited,
    draws: updatedDraws,
  };
}

/** Drop a registered team before the tournament starts. After start, use disqualify. */
export async function removeRegisteredTeam(
  uid: string,
  tournamentId: string,
  teamName: string,
): Promise<{ teamName: string; groups: TournamentGroup[] }> {
  const trimmed = teamName.trim();
  if (!trimmed) throw new ServiceError("Team is required");

  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(uid, found))) {
    throw new ServiceError("Only the tournament owner can remove a team");
  }

  const tournament = serializeTournament(found);
  if (tournament.Start) {
    throw new ServiceError(
      "This tournament has started. Disqualify the team instead.",
    );
  }

  const ids = relatedIdsFromDoc(found);
  const rCol = await registrations();
  const reg = await rCol.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byTeamName(trimmed)],
    }),
  );
  if (!reg) throw new ServiceError("Team not found");
  await rCol.deleteOne({ _id: reg._id });

  const groups = (tournament.Groups ?? []).map((group) => ({
    ...group,
    Teams: group.Teams.filter((team) => team.TeamName !== trimmed),
  }));
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Groups: groups,
        groups,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  return { teamName: trimmed, groups };
}

async function hydrateManagers(userIds: string[]): Promise<TournamentManager[]> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return [];
  const userCol = await users();
  const docs = await userCol.find({ user_id: { $in: unique } }).toArray();
  const byId = new Map(docs.map((u) => [u.user_id, u]));
  return unique.map((id) => {
    const u = byId.get(id);
    return {
      user_id: id,
      first_name: u?.first_name ?? "",
      last_name: u?.last_name ?? "",
      user_name: u?.user_name ?? "",
      email: u?.email ?? "",
    };
  });
}

/** Owner/admin: the co-managers currently allowed to help run the tournament. */
export async function listTournamentManagers(
  actorUid: string,
  tournamentId: string,
): Promise<TournamentManager[]> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  return hydrateManagers(serializeTournament(found).Managers);
}

/**
 * Owner/admin: org members that can still be added as co-managers (excludes the
 * owner and anyone already added).
 */
export async function listAssignableManagers(
  actorUid: string,
  tournamentId: string,
): Promise<TournamentManager[]> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const t = serializeTournament(found);
  if (!t.OrgId) return [];

  const memberCol = await orgMembers();
  const memberships = await memberCol
    .find({ org_id: t.OrgId })
    .limit(500)
    .toArray();
  const taken = new Set([t.User_id, ...t.Managers]);
  const candidateIds = memberships
    .map((m) => m.user_id)
    .filter((id) => !taken.has(id));
  return hydrateManagers(candidateIds);
}

/** Owner/admin: grant an org member co-manager access. */
export async function addTournamentManager(
  actorUid: string,
  tournamentId: string,
  targetUserId: string,
): Promise<TournamentManager[]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const t = serializeTournament(found);
  if (targetUserId === t.User_id) {
    throw new ServiceError("The owner already manages this tournament");
  }
  if (!t.OrgId) {
    throw new ServiceError(
      "Host this tournament under an organization to add managers",
    );
  }
  if (!(await isMember(t.OrgId, targetUserId))) {
    throw new ServiceError("That user is not a member of the organization");
  }

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $addToSet: { Managers: targetUserId },
      $set: { Updated_at: now, updated_at: now },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  const next = [...new Set([...t.Managers, targetUserId])];
  return hydrateManagers(next);
}

/** Owner/admin: revoke a co-manager's access. */
export async function removeTournamentManager(
  actorUid: string,
  tournamentId: string,
  targetUserId: string,
): Promise<TournamentManager[]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $pull: { Managers: targetUserId },
      $set: { Updated_at: now, updated_at: now },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  const next = serializeTournament(found).Managers.filter(
    (id) => id !== targetUserId,
  );
  return hydrateManagers(next);
}

export async function toggleDeleteTournament(
  uid: string,
  id: string,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const next = !serializeTournament(found).IsDeleted;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsDeleted: next,
        isdeleted: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function toggleSuspendTournament(
  uid: string,
  id: string,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const next = !serializeTournament(found).IsSuspended;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsSuspended: next,
        issuspended: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function updateTournament(
  uid: string,
  id: string,
  input: UpdateTournamentInput,
): Promise<Tournament> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, found))) {
    throw new ServiceError("You are not allowed to edit this tournament");
  }

  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    { $set: { ...input, Updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
  return serializeTournament(updated);
}

/**
 * Owner/admin: edit configurable settings before the tournament starts.
 * The size cannot drop below the number of teams already registered.
 */
export async function editTournamentSettings(
  actorUid: string,
  id: string,
  input: EditTournamentInput,
): Promise<Tournament> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("Only the tournament owner can edit settings");
  }

  const current = serializeTournament(found);
  const groupsExist = (current.Groups ?? []).length > 0;
  const ids = relatedIdsFromDoc(found);
  const drawDocs = await (await draws())
    .find(asDocFilter<DrawDoc>(byAnyTournamentId(ids)))
    .project({ Group: 1, BRTeams: 1, Kind: 1 })
    .toArray();
  const fixturesDrawn = drawDocs.length > 0;
  const knockoutDrawn = drawDocs.some((d) => {
    const group = (d.Group || "").trim();
    const br = Boolean(d.BRTeams && d.BRTeams.length);
    const kind = (d.Kind || "").trim();
    return !group && !br && kind !== "THIRD_PLACE";
  });

  const rejectAfterStart = (label: string) => {
    if (current.Start) {
      throw new ServiceError(
        `${label} can't be changed after the tournament has started`,
      );
    }
  };

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { Updated_at: now, updated_at: now };

  if (input.TournamentSize !== undefined) {
    rejectAfterStart("Tournament size");
    const ids = relatedIdsFromDoc(found);
    const registeredCount = await (await registrations()).countDocuments(
      asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)),
    );
    if (input.TournamentSize < registeredCount) {
      throw new ServiceError(
        `Size can't be less than the ${registeredCount} team${
          registeredCount === 1 ? "" : "s"
        } already registered`,
      );
    }
    set.TournamentSize = input.TournamentSize;
    set.tournamentsize = input.TournamentSize;
  }

  if (input.Shuffle !== undefined) {
    rejectAfterStart("Draw order");
    set.Shuffle = input.Shuffle;
    set.shuffle = input.Shuffle;
  }

  if (input.TournamentType !== undefined) {
    rejectAfterStart("Visibility");
    set.TournamentType = input.TournamentType;
    set.tournamenttype = input.TournamentType;
  }

  if (input.Name !== undefined) {
    rejectAfterStart("Name");
    set.Name = input.Name;
    set.name = input.Name;
  }

  if (input.Date !== undefined) {
    rejectAfterStart("Date");
    set.Date = input.Date;
    set.date = input.Date;
  }

  if (input.Note !== undefined) {
    rejectAfterStart("Briefing");
    set.Note = input.Note;
    set.note = input.Note;
  }

  if (input.ReturnLeg !== undefined) {
    if (
      current.TournamentMode !== "LEAGUE" &&
      current.TournamentMode !== "GROUPS"
    ) {
      throw new ServiceError("Return leg only applies to league and groups");
    }
    if (fixturesDrawn) {
      throw new ServiceError(
        "Return leg can't be changed after fixtures have been drawn",
      );
    }
    set.ReturnLeg = input.ReturnLeg;
    set.returnleg = input.ReturnLeg;
  }

  if (input.AdvancePerGroup !== undefined) {
    if (current.TournamentMode !== "GROUPS") {
      throw new ServiceError("Advance per group only applies to groups");
    }
    if (knockoutDrawn) {
      throw new ServiceError(
        "Advance per group can't be changed after the knockout is drawn",
      );
    }
    set.AdvancePerGroup = input.AdvancePerGroup;
    set.advancepergroup = input.AdvancePerGroup;
  }

  if (input.GroupCount !== undefined) {
    if (current.TournamentMode !== "GROUPS") {
      throw new ServiceError("Group count only applies to groups");
    }
    if (groupsExist) {
      throw new ServiceError(
        "Group count can't be changed after groups are created",
      );
    }
    set.GroupCount = input.GroupCount;
    set.groupcount = input.GroupCount;
  }

  if (input.PointSystem !== undefined) {
    if (
      current.TournamentMode !== "LEAGUE" &&
      current.TournamentMode !== "GROUPS"
    ) {
      throw new ServiceError("Point system only applies to league and groups");
    }
    if (current.TournamentMode === "LEAGUE" && fixturesDrawn) {
      throw new ServiceError(
        "Point system can't be changed after league fixtures are drawn",
      );
    }
    if (current.TournamentMode === "GROUPS" && knockoutDrawn) {
      throw new ServiceError(
        "Point system can't be changed after the knockout is drawn",
      );
    }
    set.PointSystem = {
      Win: input.PointSystem.Win,
      Draw: input.PointSystem.Draw,
    };
    set.pointsystem = set.PointSystem;
  }

  if (input.OwnerCanSelectQualifiers !== undefined) {
    if (current.TournamentMode !== "GROUPS") {
      throw new ServiceError(
        "Qualifier picks only apply to group tournaments",
      );
    }
    if (knockoutDrawn) {
      throw new ServiceError(
        "Qualifier rule can't be changed after the knockout is drawn",
      );
    }
    set.OwnerCanSelectQualifiers = input.OwnerCanSelectQualifiers;
    set.ownercanselectqualifiers = input.OwnerCanSelectQualifiers;
  }

  const isKnockoutMode =
    current.TournamentMode === "MULTIPLAYER" ||
    current.TournamentMode === "GROUPS";
  if (input.KnockoutFormat !== undefined) {
    if (!isKnockoutMode) {
      throw new ServiceError("Knockout format only applies to knockout events");
    }
    if (knockoutDrawn || (current.TournamentMode === "MULTIPLAYER" && fixturesDrawn)) {
      throw new ServiceError(
        "Knockout format can't be changed after knockout fixtures are drawn",
      );
    }
    set.KnockoutFormat = input.KnockoutFormat;
    set.knockoutformat = input.KnockoutFormat;
  }
  if (input.ThirdPlace !== undefined) {
    if (!isKnockoutMode) {
      throw new ServiceError("Third place only applies to knockout events");
    }
    if (knockoutDrawn || (current.TournamentMode === "MULTIPLAYER" && fixturesDrawn)) {
      throw new ServiceError(
        "Third place can't be changed after knockout fixtures are drawn",
      );
    }
    set.ThirdPlace = input.ThirdPlace;
    set.thirdplace = input.ThirdPlace;
  }
  if (input.TieBreaker !== undefined) {
    if (
      current.TournamentMode !== "LEAGUE" &&
      current.TournamentMode !== "GROUPS"
    ) {
      throw new ServiceError("Tie-breakers only apply to league and groups");
    }
    if (current.TournamentMode === "LEAGUE" && fixturesDrawn) {
      throw new ServiceError(
        "Tie-breaker can't be changed after league fixtures are drawn",
      );
    }
    if (current.TournamentMode === "GROUPS" && knockoutDrawn) {
      throw new ServiceError(
        "Tie-breaker can't be changed after the knockout is drawn",
      );
    }
    set.TieBreaker = input.TieBreaker;
    set.tiebreaker = input.TieBreaker;
  }
  if (
    input.BrLobbyCount !== undefined ||
    input.BrKillPoints !== undefined ||
    input.BrFirstBloodPoints !== undefined ||
    input.BrPlacementPoints !== undefined
  ) {
    if (current.TournamentMode !== "BATTLEROYALE") {
      throw new ServiceError("Battle royale scoring only applies to BR events");
    }
    if (fixturesDrawn) {
      throw new ServiceError(
        "Battle royale scoring can't be changed after lobbies are drawn",
      );
    }
    if (input.BrLobbyCount !== undefined) {
      set.BrLobbyCount = input.BrLobbyCount;
      set.brlobbycount = input.BrLobbyCount;
    }
    if (input.BrKillPoints !== undefined) {
      set.BrKillPoints = input.BrKillPoints;
      set.brkillpoints = input.BrKillPoints;
    }
    if (input.BrFirstBloodPoints !== undefined) {
      set.BrFirstBloodPoints = input.BrFirstBloodPoints;
      set.brfirstbloodpoints = input.BrFirstBloodPoints;
    }
    if (input.BrPlacementPoints !== undefined) {
      set.BrPlacementPoints = input.BrPlacementPoints;
      set.brplacementpoints = input.BrPlacementPoints;
    }
  }
  if (input.RegistrationDeadline !== undefined) {
    rejectAfterStart("Registration deadline");
    set.RegistrationDeadline = input.RegistrationDeadline;
    set.registrationdeadline = input.RegistrationDeadline;
  }
  if (input.CheckInRequired !== undefined) {
    rejectAfterStart("Check-in");
    set.CheckInRequired = input.CheckInRequired;
    set.checkinrequired = input.CheckInRequired;
  }
  if (input.CheckInOpens !== undefined) {
    rejectAfterStart("Check-in");
    set.CheckInOpens = input.CheckInOpens;
    set.checkinopens = input.CheckInOpens;
  }
  if (input.CheckInCloses !== undefined) {
    rejectAfterStart("Check-in");
    set.CheckInCloses = input.CheckInCloses;
    set.checkincloses = input.CheckInCloses;
  }
  if (input.FirstMatchAt !== undefined) {
    if (fixturesDrawn) {
      throw new ServiceError(
        "Match schedule can't be changed after fixtures are drawn",
      );
    }
    set.FirstMatchAt = input.FirstMatchAt;
    set.firstmatchat = input.FirstMatchAt;
  }
  if (input.MatchIntervalMinutes !== undefined) {
    if (fixturesDrawn) {
      throw new ServiceError(
        "Match interval can't be changed after fixtures are drawn",
      );
    }
    set.MatchIntervalMinutes = input.MatchIntervalMinutes;
    set.matchintervalminutes = input.MatchIntervalMinutes;
  }

  if (input.icon !== undefined) {
    set.icon = input.icon;
  }

  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    { $set: set } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
  if (input.icon !== undefined) {
    await (await registrations()).updateMany(
      asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)),
      {
        $set: {
          TournamentIcon: input.icon,
          tournamenticon: input.icon,
        },
      } as never,
    );
  }
  return serializeTournament(updated);
}

export async function groupTournament(
  uid: string,
  tournamentId: string,
): Promise<TournamentGroup[]> {
  const col = await tournaments();
  const tournament = await findByAnyId(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, tournament))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }

  const ids = relatedIdsFromDoc(tournament);
  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();

  if (regDocs.length < 7) {
    throw new ServiceError("You need at least 7 teams to group a tournament");
  }

  const current = serializeTournament(tournament);
  const checkedIn = new Set(
    regDocs
      .map(serializeRegistration)
      .filter((r) => !current.CheckInRequired || r.CheckedIn)
      .map((r) => r.TeamName),
  );
  const dq = asDisqualifiedSet(current.DisqualifiedTeams);
  const teams: Teams[] = regDocs
    .map((r) => {
      const reg = serializeRegistration(r);
      return {
        TeamName: reg.TeamName,
        Players: reg.Players,
        Icon: reg.Icon,
        Points: 0,
        GoalsScored: 0,
        GoalsReceived: 0,
        GoalsDifference: 0,
      };
    })
    .filter((t) => !dq.has(t.TeamName) && checkedIn.has(t.TeamName));

  if (teams.length < 7) {
    throw new ServiceError(
      current.CheckInRequired
        ? "At least 7 teams need to check in before you can create groups"
        : "You need at least 7 teams to group a tournament",
    );
  }
  const groups = buildGroups(teams, {
    shuffle: current.Shuffle === "AUTOMATIC",
    groupCount: current.GroupCount || 0,
  });
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: tournament._id },
    {
      $set: {
        Groups: groups,
        groups,
        Start: true,
        start: true,
        IsDrawn: true,
        isdrawn: true,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return groups;
}

/**
 * Manually reassign teams to groups (e.g. from an admin drag-and-drop board).
 * Rebuilds the Groups array from the given arrangement, preserving each team's
 * existing stats where possible. Every already-grouped team must be present
 * exactly once so no team is silently dropped or duplicated.
 */
export async function setTournamentGroups(
  uid: string,
  tournamentId: string,
  input: SetGroupsInput,
): Promise<TournamentGroup[]> {
  const col = await tournaments();
  const tournament = await findByAnyId(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
  if (!(await canReshuffleGroups(uid, tournament))) {
    throw new ServiceError(
      serializeTournament(tournament).OwnerCanReshuffleGroups
        ? "You are not allowed to manage this tournament"
        : "Only an admin can reshuffle groups for this tournament",
    );
  }

  const current = serializeTournament(tournament);
  if (!current.Groups || current.Groups.length === 0) {
    throw new ServiceError("This tournament has no groups yet");
  }

  // Once fixtures exist, the groups are locked in — moving teams would
  // desync them from the drawn matches.
  const ids = relatedIdsFromDoc(tournament);
  const drawCount = await (await draws()).countDocuments(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );
  if (drawCount > 0) {
    throw new ServiceError(
      "Teams can't be moved after fixtures have been drawn",
    );
  }

  // Preserve existing team objects (with any recorded stats) by name.
  const existingByName = new Map<string, Teams>();
  for (const group of current.Groups) {
    for (const team of group.Teams) existingByName.set(team.TeamName, team);
  }

  const requested = input.Groups.flatMap((g) => g.TeamNames);
  const requestedSet = new Set(requested);
  if (requestedSet.size !== requested.length) {
    throw new ServiceError("A team can only be in one group");
  }
  if (requestedSet.size !== existingByName.size) {
    throw new ServiceError("Every team must stay assigned to a group");
  }
  for (const name of requestedSet) {
    if (!existingByName.has(name)) {
      throw new ServiceError(`Unknown team: ${name}`);
    }
  }

  const groups: TournamentGroup[] = input.Groups.map((g) => ({
    GroupName: g.GroupName,
    Teams: g.TeamNames.map((name) => existingByName.get(name) as Teams),
  }));

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: tournament._id },
    {
      $set: {
        Groups: groups,
        groups,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return groups;
}

/* --------------------------- helpers --------------------------- */

async function findByAnyId(id: string): Promise<TournamentDoc | null> {
  const col = await tournaments();
  // Prefer the Mongo _id when the URL is a 24-char hex so two documents that
  // share a legacy `tournamentid` (data clones) stay distinguishable.
  if (ObjectId.isValid(id) && id.length === 24) {
    const byObjectId = await col.findOne({ _id: new ObjectId(id) });
    if (byObjectId) return byObjectId;
  }
  return col.findOne(asDocFilter<TournamentDoc>(byTournamentId(id)));
}

function relatedIdsFromDoc(doc: TournamentDoc): string[] {
  const raw = asRecord(doc);
  return [
    ...new Set(
      [
        doc._id.toHexString(),
        serializeTournament(doc).TournamentId,
        readString(raw, ["TournamentId", "tournamentid"]),
      ].filter((id) => id.length > 0),
    ),
  ];
}

export async function checkInForTournament(
  uid: string,
  tournamentId: string,
): Promise<RegisterTournament> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(found);
  if (!tournament.CheckInRequired) {
    throw new ServiceError("This tournament does not require check-in");
  }
  if (!checkInWindowOpen(tournament)) {
    throw new ServiceError("Check-in is closed");
  }
  const ids = relatedIdsFromDoc(found);
  const rCol = await registrations();
  const reg = await rCol.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byPlayerUserId(uid)],
    }),
  );
  if (!reg) throw new ServiceError("You are not registered for this tournament");
  const current = serializeRegistration(reg);
  if (current.CheckedIn) return current;
  const now = new Date().toISOString();
  const updated = await rCol.findOneAndUpdate(
    { _id: reg._id },
    { $set: { CheckedIn: true, CheckedInAt: now, Updated_at: now } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Registration not found");
  return serializeRegistration(updated);
}

export async function relatedTournamentIds(id: string): Promise<string[]> {
  const found = await findByAnyId(id);
  if (!found) return [id];
  return relatedIdsFromDoc(found);
}

function buildGroups(
  teams: Teams[],
  opts: { shuffle: boolean; groupCount: number },
): TournamentGroup[] {
  const ordered = opts.shuffle
    ? [...teams].sort(() => Math.random() - 0.5)
    : [...teams];
  const autoCount = Math.max(2, Math.ceil(ordered.length / 4));
  const maxCount = Math.max(2, Math.floor(ordered.length / 2));
  let groupCount =
    opts.groupCount > 0 ? opts.groupCount : autoCount;
  groupCount = Math.min(Math.max(2, groupCount), maxCount);
  const groups: TournamentGroup[] = Array.from(
    { length: groupCount },
    (_, i) => ({ GroupName: `Group ${String.fromCharCode(65 + i)}`, Teams: [] }),
  );
  ordered.forEach((team, index) => {
    groups[index % groupCount].Teams.push(team);
  });
  return groups;
}
