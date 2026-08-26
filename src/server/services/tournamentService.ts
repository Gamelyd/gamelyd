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
import { FALLBACKS, playerIconFor } from "@/lib/icons";

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
      Win: input.PointSystem?.Win || 3,
      Draw: input.PointSystem?.Draw || 1,
    },
    ReturnLeg: input.TournamentMode === "LEAGUE" ? Boolean(input.ReturnLeg) : false,
    Featured: false,
    Managers: [],
    OwnerCanReshuffleGroups: true,
    OwnerCanAddParticipants: false,
    OwnerCanSelectQualifiers: false,
    Qualifiers: [],
    DisqualifiedTeams: [],
    AdvancePerGroup:
      input.TournamentMode === "GROUPS" ? input.AdvancePerGroup || 2 : 2,
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

  const needed = rosterSize(tournament.Team);
  if (input.Players.length !== needed) {
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
 * Platform admin: register existing users as a team. Same rules as public
 * registration — tournament must not have started, roster size must match,
 * and no player may already be in the event.
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

  const teamName =
    input.teamName?.trim() ||
    (users.length === 1
      ? users[0].user_name
      : users.map((u) => u.user_name).join(" / "));

  return registerForTournament(tournamentId, {
    TeamName: teamName,
    Icon: FALLBACKS.team,
    Players: users.map((u) => ({
      UserName: u.user_name || u.first_name || "Player",
      GameUserName: "",
      User_id: u.user_id,
      Email: u.email || "",
      Icon: playerIconFor(u.user_id),
    })),
    RefNumber: "",
    PaymentChannel: "",
    Amount: 0,
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
  if (
    actorUid !== userId &&
    !(await canManageTournament(actorUid, found))
  ) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }

  const col = await registrations();
  const ids = await relatedTournamentIds(tournamentId);
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
  if (current.Start) {
    throw new ServiceError(
      "Settings can't be changed after the tournament has started",
    );
  }

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { Updated_at: now, updated_at: now };

  if (input.TournamentSize !== undefined) {
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
    set.Shuffle = input.Shuffle;
    set.shuffle = input.Shuffle;
  }

  if (input.TournamentType !== undefined) {
    set.TournamentType = input.TournamentType;
    set.tournamenttype = input.TournamentType;
  }

  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    { $set: set } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
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

  const dq = asDisqualifiedSet(serializeTournament(tournament).DisqualifiedTeams);
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
    .filter((t) => !dq.has(t.TeamName));

  if (teams.length < 7) {
    throw new ServiceError("You need at least 7 teams to group a tournament");
  }

  const groups = buildGroups(teams);
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

export async function relatedTournamentIds(id: string): Promise<string[]> {
  const found = await findByAnyId(id);
  if (!found) return [id];
  return relatedIdsFromDoc(found);
}

function buildGroups(teams: Teams[]): TournamentGroup[] {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const groupCount = Math.ceil(shuffled.length / 4);
  const groups: TournamentGroup[] = Array.from(
    { length: groupCount },
    (_, i) => ({ GroupName: `Group ${String.fromCharCode(65 + i)}`, Teams: [] }),
  );
  shuffled.forEach((team, index) => {
    groups[index % groupCount].Teams.push(team);
  });
  return groups;
}
