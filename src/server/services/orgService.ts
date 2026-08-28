import "server-only";
import { ObjectId } from "mongodb";
import { orgs, orgInvites, orgMembers, tournaments, users } from "../db";
import type { OrgDoc, OrgInviteDoc, OrgMemberDoc, TournamentDoc } from "../documents";
import {
  serializeOrg,
  serializeOrgInvite,
  serializeTournament,
} from "../serialize";
import { asDocFilter, byOrgId, notDeleted } from "../legacy";
import { ServiceError } from "./userService";
import { createNotification } from "./notificationService";
import type {
  Org,
  OrgInvite,
  OrgMemberWithUser,
  OrgWithRole,
  CreateOrgInput,
  InviteMemberInput,
  UpdateOrgInput,
} from "@/lib/schemas/org";
import type { OrgRole } from "@/lib/schemas/common";
import type { Tournament } from "@/lib/schemas/tournament";
import type { Paginated } from "@/lib/result";

const MANAGE_ROLES: OrgRole[] = ["OWNER", "ADMIN"];

export async function createOrg(
  uid: string,
  input: CreateOrgInput,
): Promise<Org> {
  const col = await orgs();

  const nameTaken = await col.countDocuments({
    name: input.name,
    isDeleted: { $ne: true },
  });
  if (nameTaken > 0) {
    throw new ServiceError("An organization with that name already exists");
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const orgId = _id.toHexString();

  const doc: OrgDoc = {
    _id,
    org_id: orgId,
    name: input.name,
    description: input.description,
    image: input.image,
    banner: input.banner,
    website: input.website,
    twitter: input.twitter,
    instagram: input.instagram,
    linkedin: input.linkedin,
    facebook: input.facebook,
    owner_id: uid,
    created_at: now,
    updated_at: now,
    isDeleted: false,
    verified: false,
  };
  await col.insertOne(doc);

  const memberCol = await orgMembers();
  await memberCol.insertOne({
    _id: new ObjectId(),
    org_id: orgId,
    user_id: uid,
    role: "OWNER",
    created_at: now,
  });

  return serializeOrg(doc);
}

export async function getOrgById(orgId: string): Promise<Org | null> {
  const col = await orgs();
  const found = await col.findOne({ org_id: orgId, isDeleted: { $ne: true } });
  return found ? serializeOrg(found) : null;
}

export async function getOrgByIdAdmin(orgId: string): Promise<Org | null> {
  const col = await orgs();
  const found = await col.findOne({ org_id: orgId });
  return found ? serializeOrg(found) : null;
}

export async function listOrgs(
  search: string,
  page: number,
): Promise<Paginated<Org>> {
  const col = await orgs();
  const perPage = 20;
  const safePage = Math.max(page, 1);
  const filter =
    search.trim().length > 0
      ? { name: { $regex: search, $options: "i" } }
      : {};

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
    items: docs.map(serializeOrg),
  };
}

export async function getMembership(
  orgId: string,
  userId: string,
): Promise<OrgMemberDoc | null> {
  const col = await orgMembers();
  return col.findOne({ org_id: orgId, user_id: userId });
}

export async function isMember(
  orgId: string,
  userId: string,
): Promise<boolean> {
  return (await getMembership(orgId, userId)) !== null;
}

async function requireManageRole(
  orgId: string,
  userId: string,
): Promise<OrgMemberDoc> {
  const membership = await getMembership(orgId, userId);
  if (!membership || !MANAGE_ROLES.includes(membership.role)) {
    throw new ServiceError("You do not have permission to manage this organization");
  }
  return membership;
}

export async function updateOrg(
  uid: string,
  orgId: string,
  input: UpdateOrgInput,
): Promise<Org> {
  await requireManageRole(orgId, uid);
  const col = await orgs();

  if (input.name) {
    const taken = await col.countDocuments({
      name: input.name,
      org_id: { $ne: orgId },
      isDeleted: { $ne: true },
    });
    if (taken > 0) {
      throw new ServiceError("An organization with that name already exists");
    }
  }

  const updated = await col.findOneAndUpdate(
    { org_id: orgId },
    { $set: { ...input, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Organization not found");
  return serializeOrg(updated);
}

export async function listUserOrgs(userId: string): Promise<OrgWithRole[]> {
  const memberCol = await orgMembers();
  const memberships = await memberCol
    .find({ user_id: userId })
    .limit(200)
    .toArray();
  if (memberships.length === 0) return [];

  const orgCol = await orgs();
  const ids = memberships.map((m) => m.org_id);
  const orgDocs = await orgCol
    .find({ org_id: { $in: ids }, isDeleted: { $ne: true } })
    .toArray();

  const roleByOrg = new Map<string, OrgRole>(
    memberships.map((m) => [m.org_id, m.role]),
  );

  return orgDocs.map((doc) => ({
    ...serializeOrg(doc),
    role: roleByOrg.get(doc.org_id) ?? "MEMBER",
  }));
}

export async function listMembers(
  orgId: string,
): Promise<OrgMemberWithUser[]> {
  const memberCol = await orgMembers();
  const memberships = await memberCol
    .find({ org_id: orgId })
    .limit(500)
    .toArray();
  if (memberships.length === 0) return [];

  const userCol = await users();
  const ids = memberships.map((m) => m.user_id);
  const userDocs = await userCol.find({ user_id: { $in: ids } }).toArray();
  const byId = new Map(userDocs.map((u) => [u.user_id, u]));

  return memberships.map((m) => {
    const u = byId.get(m.user_id);
    return {
      _id: m._id.toHexString(),
      org_id: m.org_id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      first_name: u?.first_name ?? "",
      last_name: u?.last_name ?? "",
      user_name: u?.user_name ?? "",
      email: u?.email ?? "",
      verified: Boolean(u?.verified),
    };
  });
}

export async function inviteMember(
  inviterUid: string,
  orgId: string,
  input: InviteMemberInput,
): Promise<void> {
  await requireManageRole(orgId, inviterUid);

  const org = await getOrgById(orgId);
  if (!org) throw new ServiceError("Organization not found");

  const userCol = await users();
  const invitee = await userCol.findOne({
    $or: [
      { user_name: input.usernameOrEmail },
      { email: input.usernameOrEmail },
    ],
  });
  if (!invitee) throw new ServiceError("No user found with that username or email");

  if (await isMember(orgId, invitee.user_id)) {
    throw new ServiceError("That user is already a member");
  }

  const inviteCol = await orgInvites();
  const existing = await inviteCol.countDocuments({
    org_id: orgId,
    invitee_id: invitee.user_id,
    status: "PENDING",
  });
  if (existing > 0) {
    throw new ServiceError("That user already has a pending invite");
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  await inviteCol.insertOne({
    _id,
    invite_id: _id.toHexString(),
    org_id: orgId,
    org_name: org.name,
    inviter_id: inviterUid,
    invitee_id: invitee.user_id,
    role: input.role,
    status: "PENDING",
    created_at: now,
    updated_at: now,
  });

  await createNotification(
    invitee.user_id,
    `You have been invited to join ${org.name}`,
  );
}

export async function listUserInvites(userId: string): Promise<OrgInvite[]> {
  const col = await orgInvites();
  const docs = await col
    .find({ invitee_id: userId, status: "PENDING" })
    .sort({ _id: -1 })
    .limit(100)
    .toArray();
  return docs.map(serializeOrgInvite);
}

async function findPendingInvite(
  inviteId: string,
  userId: string,
): Promise<OrgInviteDoc> {
  const col = await orgInvites();
  const invite = await col.findOne({
    invite_id: inviteId,
    invitee_id: userId,
    status: "PENDING",
  });
  if (!invite) throw new ServiceError("Invite not found");
  return invite;
}

export async function acceptInvite(
  userId: string,
  inviteId: string,
): Promise<void> {
  const invite = await findPendingInvite(inviteId, userId);
  const now = new Date().toISOString();

  if (!(await isMember(invite.org_id, userId))) {
    const memberCol = await orgMembers();
    await memberCol.insertOne({
      _id: new ObjectId(),
      org_id: invite.org_id,
      user_id: userId,
      role: invite.role,
      created_at: now,
    });
  }

  const col = await orgInvites();
  await col.updateOne(
    { invite_id: inviteId },
    { $set: { status: "ACCEPTED", updated_at: now } },
  );
}

export async function declineInvite(
  userId: string,
  inviteId: string,
): Promise<void> {
  await findPendingInvite(inviteId, userId);
  const col = await orgInvites();
  await col.updateOne(
    { invite_id: inviteId },
    { $set: { status: "DECLINED", updated_at: new Date().toISOString() } },
  );
}

export async function removeMember(
  actorUid: string,
  orgId: string,
  targetUid: string,
): Promise<void> {
  await requireManageRole(orgId, actorUid);

  const target = await getMembership(orgId, targetUid);
  if (!target) throw new ServiceError("That user is not a member");

  if (target.role === "OWNER") {
    const memberCol = await orgMembers();
    const owners = await memberCol.countDocuments({
      org_id: orgId,
      role: "OWNER",
    });
    if (owners <= 1) {
      throw new ServiceError("You cannot remove the last owner");
    }
  }

  const memberCol = await orgMembers();
  await memberCol.deleteOne({ org_id: orgId, user_id: targetUid });
}

/** Admin: remove a member without requiring org membership of the actor. */
export async function adminRemoveMember(
  orgId: string,
  targetUid: string,
): Promise<void> {
  const target = await getMembership(orgId, targetUid);
  if (!target) throw new ServiceError("That user is not a member");

  if (target.role === "OWNER") {
    const memberCol = await orgMembers();
    const owners = await memberCol.countDocuments({
      org_id: orgId,
      role: "OWNER",
    });
    if (owners <= 1) {
      throw new ServiceError("You cannot remove the last owner");
    }
  }

  const memberCol = await orgMembers();
  await memberCol.deleteOne({ org_id: orgId, user_id: targetUid });
}

export async function setOrgVerified(
  orgId: string,
  verified: boolean,
): Promise<Org> {
  const col = await orgs();
  const updated = await col.findOneAndUpdate(
    { org_id: orgId },
    { $set: { verified, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Organization not found");
  const now = new Date().toISOString();
  const tCol = await tournaments();
  await tCol.updateMany(asDocFilter<TournamentDoc>(byOrgId(orgId)), {
    $set: { OrgVerified: verified, Updated_at: now },
  });
  return serializeOrg(updated);
}

export async function toggleDeleteOrg(orgId: string): Promise<boolean> {
  const col = await orgs();
  const found = await col.findOne({ org_id: orgId });
  if (!found) throw new ServiceError("Organization not found");
  const next = !found.isDeleted;
  await col.updateOne(
    { org_id: orgId },
    { $set: { isDeleted: next, updated_at: new Date().toISOString() } },
  );
  return next;
}

export async function adminUpdateOrg(
  orgId: string,
  input: UpdateOrgInput,
): Promise<Org> {
  const col = await orgs();

  if (input.name) {
    const taken = await col.countDocuments({
      name: input.name,
      org_id: { $ne: orgId },
      isDeleted: { $ne: true },
    });
    if (taken > 0) {
      throw new ServiceError("An organization with that name already exists");
    }
  }

  const updated = await col.findOneAndUpdate(
    { org_id: orgId },
    { $set: { ...input, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Organization not found");
  return serializeOrg(updated);
}

export async function listOrgTournaments(
  orgId: string,
  page: number,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const perPage = 12;
  const safePage = Math.max(page, 1);
  const filter = asDocFilter<TournamentDoc>({
    $and: [byOrgId(orgId), notDeleted()],
  });

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
