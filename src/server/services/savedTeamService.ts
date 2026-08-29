import "server-only";
import { ObjectId } from "mongodb";
import {
  savedTeamInvites,
  savedTeamMembers,
  savedTeams,
  tournaments,
} from "@/server/db";
import type {
  SavedTeamDoc,
  SavedTeamInviteDoc,
  SavedTeamMemberDoc,
  TournamentDoc,
} from "@/server/documents";
import { serializeTournament } from "@/server/serialize";
import { asDocFilter, byTournamentId } from "@/server/legacy";
import {
  ServiceError,
  findUserByHandle,
  getUserById,
} from "@/server/services/userService";
import { createNotification } from "@/server/services/notificationService";
import { playerIconForUser } from "@/server/services/iconService";
import type {
  CreateSavedTeamInput,
  SavedTeam,
  SavedTeamInvite,
  SavedTeamMember,
  UpdateSavedTeamInput,
} from "@/lib/schemas/savedTeam";
import type { Player } from "@/lib/schemas/draw";
import { catalogUrl } from "@/lib/icons";

const MAX_TEAMS_PER_USER = 10;
const MAX_MEMBERS = 32;

/* ------------------------------ reads ------------------------------ */

async function hydrateMembers(
  docs: SavedTeamMemberDoc[],
): Promise<SavedTeamMember[]> {
  const rows = await Promise.all(
    docs.map(async (doc) => {
      const user = await getUserById(doc.user_id);
      return {
        user_id: doc.user_id,
        role: doc.role,
        user_name: user?.user_name ?? "",
        first_name: user?.first_name ?? "",
        email: user?.email ?? "",
        icon: user?.icon ?? "",
        verified: Boolean(user?.verified),
        game_user_name: doc.game_user_name ?? "",
        created_at: doc.created_at ?? "",
      } satisfies SavedTeamMember;
    }),
  );
  // Captain first, then in join order, so the roster always reads the same way.
  return rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === "CAPTAIN" ? -1 : 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

async function hydrateTeam(
  doc: SavedTeamDoc,
  viewerId: string,
): Promise<SavedTeam> {
  const memberDocs = await (await savedTeamMembers())
    .find({ team_id: doc.team_id })
    .toArray();
  return {
    team_id: doc.team_id,
    name: doc.name,
    icon: catalogUrl(doc.icon),
    captain_id: doc.captain_id,
    members: await hydrateMembers(memberDocs),
    isCaptain: doc.captain_id === viewerId,
    created_at: doc.created_at ?? "",
  };
}

export async function listMySavedTeams(uid: string): Promise<SavedTeam[]> {
  const memberships = await (await savedTeamMembers())
    .find({ user_id: uid })
    .toArray();
  const ids = memberships.map((m) => m.team_id);
  if (ids.length === 0) return [];
  const docs = await (await savedTeams())
    .find({ team_id: { $in: ids }, isDeleted: { $ne: true } })
    .toArray();
  return Promise.all(docs.map((doc) => hydrateTeam(doc, uid)));
}

export async function getSavedTeam(
  teamId: string,
  viewerId: string,
): Promise<SavedTeam | null> {
  const doc = await (await savedTeams()).findOne({
    team_id: teamId,
    isDeleted: { $ne: true },
  });
  return doc ? hydrateTeam(doc, viewerId) : null;
}

async function requireCaptain(
  teamId: string,
  uid: string,
): Promise<SavedTeamDoc> {
  const doc = await (await savedTeams()).findOne({
    team_id: teamId,
    isDeleted: { $ne: true },
  });
  if (!doc) throw new ServiceError("Team not found");
  if (doc.captain_id !== uid) {
    throw new ServiceError("Only the team captain can do this");
  }
  return doc;
}

async function requireMember(
  teamId: string,
  uid: string,
): Promise<SavedTeamDoc> {
  const doc = await (await savedTeams()).findOne({
    team_id: teamId,
    isDeleted: { $ne: true },
  });
  if (!doc) throw new ServiceError("Team not found");
  const member = await (await savedTeamMembers()).findOne({
    team_id: teamId,
    user_id: uid,
  });
  if (!member) throw new ServiceError("You are not on this team");
  return doc;
}

/* ------------------------------ writes ----------------------------- */

export async function createSavedTeam(
  uid: string,
  input: CreateSavedTeamInput,
): Promise<SavedTeam> {
  const owned = await (await savedTeams()).countDocuments({
    captain_id: uid,
    isDeleted: { $ne: true },
  });
  if (owned >= MAX_TEAMS_PER_USER) {
    throw new ServiceError(`You can keep up to ${MAX_TEAMS_PER_USER} teams`);
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const teamId = _id.toHexString();
  const doc: SavedTeamDoc = {
    _id,
    team_id: teamId,
    name: input.name,
    icon: input.icon,
    captain_id: uid,
    created_at: now,
    updated_at: now,
    isDeleted: false,
  };
  await (await savedTeams()).insertOne(doc);
  await (await savedTeamMembers()).insertOne({
    _id: new ObjectId(),
    team_id: teamId,
    user_id: uid,
    role: "CAPTAIN",
    game_user_name: input.game_user_name ?? "",
    created_at: now,
  });
  return hydrateTeam(doc, uid);
}

export async function updateSavedTeam(
  uid: string,
  teamId: string,
  input: UpdateSavedTeamInput,
): Promise<SavedTeam> {
  const doc = await requireCaptain(teamId, uid);
  const patch: Partial<SavedTeamDoc> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.icon !== undefined) patch.icon = input.icon;
  await (await savedTeams()).updateOne({ team_id: teamId }, { $set: patch });
  return hydrateTeam({ ...doc, ...patch }, uid);
}

export async function deleteSavedTeam(
  uid: string,
  teamId: string,
): Promise<void> {
  await requireCaptain(teamId, uid);
  await (await savedTeams()).updateOne(
    { team_id: teamId },
    { $set: { isDeleted: true, updated_at: new Date().toISOString() } },
  );
}

export async function setMyGameUserName(
  uid: string,
  teamId: string,
  gameUserName: string,
): Promise<SavedTeam> {
  const doc = await requireMember(teamId, uid);
  await (await savedTeamMembers()).updateOne(
    { team_id: teamId, user_id: uid },
    { $set: { game_user_name: gameUserName } },
  );
  return hydrateTeam(doc, uid);
}

export async function leaveSavedTeam(
  uid: string,
  teamId: string,
): Promise<void> {
  const doc = await requireMember(teamId, uid);
  if (doc.captain_id === uid) {
    throw new ServiceError(
      "You captain this team. Delete it instead, or hand it to someone else first.",
    );
  }
  await (await savedTeamMembers()).deleteOne({ team_id: teamId, user_id: uid });
  const user = await getUserById(uid);
  void createNotification(
    doc.captain_id,
    `${user?.user_name || "A player"} left your team ${doc.name}.`,
    { kind: "GENERIC", team_id: teamId },
  ).catch(() => undefined);
}

export async function removeSavedTeamMember(
  uid: string,
  teamId: string,
  memberId: string,
): Promise<void> {
  const doc = await requireCaptain(teamId, uid);
  if (memberId === doc.captain_id) {
    throw new ServiceError("The captain cannot be removed from their own team");
  }
  await (await savedTeamMembers()).deleteOne({
    team_id: teamId,
    user_id: memberId,
  });
  void createNotification(
    memberId,
    `You were removed from the team ${doc.name}.`,
    { kind: "GENERIC", team_id: teamId },
  ).catch(() => undefined);
}

/** Hands the team to another member, demoting the current captain. */
export async function transferSavedTeamCaptain(
  uid: string,
  teamId: string,
  memberId: string,
): Promise<SavedTeam> {
  const doc = await requireCaptain(teamId, uid);
  const member = await (await savedTeamMembers()).findOne({
    team_id: teamId,
    user_id: memberId,
  });
  if (!member) throw new ServiceError("That player is not on this team");

  const col = await savedTeamMembers();
  await col.updateOne(
    { team_id: teamId, user_id: memberId },
    { $set: { role: "CAPTAIN" } },
  );
  await col.updateOne(
    { team_id: teamId, user_id: uid },
    { $set: { role: "MEMBER" } },
  );
  const now = new Date().toISOString();
  await (await savedTeams()).updateOne(
    { team_id: teamId },
    { $set: { captain_id: memberId, updated_at: now } },
  );
  void createNotification(
    memberId,
    `You are now the captain of ${doc.name}.`,
    { kind: "GENERIC", team_id: teamId },
  ).catch(() => undefined);
  return hydrateTeam({ ...doc, captain_id: memberId, updated_at: now }, uid);
}

/* ----------------------------- invites ----------------------------- */

export async function inviteToSavedTeam(
  uid: string,
  teamId: string,
  usernameOrEmail: string,
): Promise<SavedTeamInvite> {
  const team = await requireCaptain(teamId, uid);

  const memberCount = await (await savedTeamMembers()).countDocuments({
    team_id: teamId,
  });
  if (memberCount >= MAX_MEMBERS) {
    throw new ServiceError(`A team can hold up to ${MAX_MEMBERS} players`);
  }

  const invitee = await findUserByHandle(usernameOrEmail);
  if (!invitee) {
    throw new ServiceError("No user found with that username or email");
  }
  if (invitee.user_id === uid) {
    throw new ServiceError("You are already on this team");
  }

  const existingMember = await (await savedTeamMembers()).findOne({
    team_id: teamId,
    user_id: invitee.user_id,
  });
  if (existingMember) {
    throw new ServiceError(`${invitee.user_name} is already on this team`);
  }

  const iCol = await savedTeamInvites();
  const pending = await iCol.findOne({
    team_id: teamId,
    invitee_id: invitee.user_id,
    status: "PENDING",
  });
  if (pending) {
    throw new ServiceError(`${invitee.user_name} already has a pending invite`);
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: SavedTeamInviteDoc = {
    _id,
    invite_id: _id.toHexString(),
    team_id: teamId,
    team_name: team.name,
    inviter_id: uid,
    invitee_id: invitee.user_id,
    status: "PENDING",
    created_at: now,
    updated_at: now,
  };
  await iCol.insertOne(doc);

  const inviter = await getUserById(uid);
  void createNotification(
    invitee.user_id,
    `${inviter?.user_name || "Someone"} invited you to join their team ${team.name}.`,
    {
      kind: "SAVED_TEAM_INVITE",
      invite_id: doc.invite_id,
      team_id: teamId,
    },
  ).catch(() => undefined);

  return {
    invite_id: doc.invite_id,
    team_id: teamId,
    team_name: team.name,
    team_icon: catalogUrl(team.icon),
    inviter_id: uid,
    inviter_name: inviter?.user_name ?? "",
    invitee_id: invitee.user_id,
    status: "PENDING",
    created_at: now,
  };
}

export async function listMySavedTeamInvites(
  uid: string,
): Promise<SavedTeamInvite[]> {
  const docs = await (await savedTeamInvites())
    .find({ invitee_id: uid, status: "PENDING" })
    .sort({ _id: -1 })
    .toArray();
  return Promise.all(
    docs.map(async (doc) => {
      const [inviter, team] = await Promise.all([
        getUserById(doc.inviter_id),
        (await savedTeams()).findOne({ team_id: doc.team_id }),
      ]);
      return {
        invite_id: doc.invite_id,
        team_id: doc.team_id,
        team_name: doc.team_name || team?.name || "",
        team_icon: catalogUrl(team?.icon ?? ""),
        inviter_id: doc.inviter_id,
        inviter_name: inviter?.user_name ?? "",
        invitee_id: doc.invitee_id,
        status: doc.status,
        created_at: doc.created_at ?? "",
      } satisfies SavedTeamInvite;
    }),
  );
}

export async function respondToSavedTeamInvite(
  uid: string,
  inviteId: string,
  accept: boolean,
): Promise<void> {
  const iCol = await savedTeamInvites();
  const invite = await iCol.findOne({ invite_id: inviteId });
  if (!invite) throw new ServiceError("Invite not found");
  if (invite.invitee_id !== uid) {
    throw new ServiceError("This invite is not for you");
  }
  if (invite.status !== "PENDING") {
    throw new ServiceError("This invite was already answered");
  }

  const now = new Date().toISOString();
  await iCol.updateOne(
    { invite_id: inviteId },
    { $set: { status: accept ? "ACCEPTED" : "DECLINED", updated_at: now } },
  );

  const user = await getUserById(uid);
  if (!accept) {
    void createNotification(
      invite.inviter_id,
      `${user?.user_name || "A player"} declined your invite to ${invite.team_name}.`,
      { kind: "GENERIC", team_id: invite.team_id },
    ).catch(() => undefined);
    return;
  }

  const team = await (await savedTeams()).findOne({
    team_id: invite.team_id,
    isDeleted: { $ne: true },
  });
  if (!team) throw new ServiceError("That team no longer exists");

  await (await savedTeamMembers()).updateOne(
    { team_id: invite.team_id, user_id: uid },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        team_id: invite.team_id,
        user_id: uid,
        role: "MEMBER",
        game_user_name: "",
        created_at: now,
      },
    },
    { upsert: true },
  );

  void createNotification(
    invite.inviter_id,
    `${user?.user_name || "A player"} joined your team ${team.name}.`,
    { kind: "GENERIC", team_id: invite.team_id },
  ).catch(() => undefined);
}

/* ------------------------- tournament bridge ------------------------ */

/**
 * A teammate nudging their captain to enter an event. The captain gets a
 * notification carrying both ids so they can register the roster in one click.
 */
export async function alertCaptainAboutTournament(
  uid: string,
  teamId: string,
  tournamentId: string,
): Promise<void> {
  const team = await requireMember(teamId, uid);
  if (team.captain_id === uid) {
    throw new ServiceError("You captain this team - you can register it yourself");
  }

  const found = await (
    await tournaments()
  ).findOne(asDocFilter<TournamentDoc>(byTournamentId(tournamentId)));
  if (!found) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(found);
  if (tournament.Start) throw new ServiceError("That tournament has started");

  const user = await getUserById(uid);
  await createNotification(
    team.captain_id,
    `${user?.user_name || "A teammate"} wants ${team.name} to enter ${tournament.Name}.`,
    {
      kind: "TOURNAMENT_ALERT",
      tournament_id: tournament.TournamentId,
      team_id: teamId,
    },
  );
}

/**
 * The saved roster as tournament players. Used when a captain enters a saved
 * team into an event, so teammates do not each need a separate invite.
 */
export async function savedTeamRoster(
  teamId: string,
  uid: string,
  limit: number,
): Promise<{ team: SavedTeamDoc; players: Player[] }> {
  const team = await requireCaptain(teamId, uid);
  const memberDocs = await (await savedTeamMembers())
    .find({ team_id: teamId })
    .toArray();
  const members = await hydrateMembers(memberDocs);
  if (members.length > limit) {
    throw new ServiceError(
      `${team.name} has ${members.length} players but this tournament allows ${limit}. Remove players or register manually.`,
    );
  }

  const players = await Promise.all(
    members.map(async (member) => ({
      UserName: member.user_name || member.first_name || "Player",
      GameUserName: member.game_user_name,
      User_id: member.user_id,
      Email: member.email,
      Icon: member.icon || (await playerIconForUser(member.user_id)),
      Verified: member.verified,
    })),
  );
  return { team, players };
}

/**
 * Turns a saved team into the fields a tournament registration needs. Shared by
 * the free path and the paid checkout so both enter identical rosters.
 */
export async function resolveSavedTeamRegistration(
  uid: string,
  savedTeamId: string,
  limit: number,
): Promise<{ Players: Player[]; TeamName: string; Icon: string }> {
  const { team, players } = await savedTeamRoster(savedTeamId, uid, limit);
  // The captain is who paid and who prize money returns to, so they lead the
  // roster - `registerForTournament` reads Players[0] as the fallback captain.
  const ordered = [
    ...players.filter((p) => p.User_id === team.captain_id),
    ...players.filter((p) => p.User_id !== team.captain_id),
  ];
  return {
    Players: ordered,
    TeamName: team.name,
    Icon: catalogUrl(team.icon),
  };
}
