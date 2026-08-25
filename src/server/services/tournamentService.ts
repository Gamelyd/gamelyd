import "server-only";
import { ObjectId } from "mongodb";
import { registrations, tournaments, invites } from "../db";
import type { RegisterTournamentDoc, TournamentDoc } from "../documents";
import {
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
import type { Player } from "@/lib/schemas/draw";
import type { Teams } from "@/lib/schemas/draw";
import type { TournamentGroup } from "@/lib/schemas/tournament";
import type { Paginated } from "@/lib/result";
import type {
  SaveTournamentInput,
  UpdateTournamentInput,
} from "@/lib/schemas/tournament";
import type { RegisterTournamentInput } from "@/lib/schemas/register";
import { rosterSize } from "@/lib/schemas/common";

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
  userId: string,
  tournamentId: string,
): Promise<void> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
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
  userId: string,
  tournamentId: string,
): Promise<Player[]> {
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

/** True if the user created the tournament or is a member of the owning org. */
export async function canManageTournament(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  const t = serializeTournament(doc);
  if (t.User_id === uid) return true;
  if (t.OrgId) return isMember(t.OrgId, uid);
  return false;
}

export async function canManageTournamentById(
  uid: string,
  tournamentId: string,
): Promise<boolean> {
  const found = await findByAnyId(tournamentId);
  if (!found) return false;
  return canManageTournament(uid, found);
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

  const teams: Teams[] = regDocs.map((r) => {
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
  });

  const groups = buildGroups(teams);
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: tournament._id },
    {
      $set: {
        Groups: groups,
        groups,
        IsDrawn: true,
        isdrawn: true,
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
