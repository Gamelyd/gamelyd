import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { invites, registrations, tournaments } from "../db";
import type { InviteTournamentDoc, RegisterTournamentDoc } from "../documents";
import { serializeInvite } from "../serialize";
import {
  asDocFilter,
  byAnyTournamentId,
  byPlayerUserId,
  byTournamentId,
} from "../legacy";
import {
  ServiceError,
  findUserByHandle,
  getUserById,
  assertCanParticipate,
} from "./userService";
import {
  addPlayerToTeam,
  canManageTournamentById,
  getTournamentById,
  relatedTournamentIds,
} from "./tournamentService";
import { createNotification } from "./notificationService";
import { sendEmail } from "../email/mailer";
import {
  teamInviteEmail,
  tournamentInviteEmail,
} from "../email/templates";
import type { InviteTournament } from "@/lib/schemas/misc";
import { rosterOverCapMessage, rosterSize } from "@/lib/schemas/common";
import { isCaptain } from "@/lib/captain";
import { playerIconForUser } from "./iconService";

function pendingForUser(userId: string): Filter<InviteTournamentDoc> {
  return {
    $and: [
      { $or: [{ invitee_id: userId }, { user_id: userId }] },
      { status: { $nin: ["ACCEPTED", "DECLINED"] } },
    ],
  } as Filter<InviteTournamentDoc>;
}

async function hydrateInvite(
  doc: InviteTournamentDoc,
): Promise<InviteTournament> {
  const invite = serializeInvite(doc);
  if (invite.inviter_id) {
    const inviter = await getUserById(invite.inviter_id);
    invite.inviter_name =
      inviter?.user_name || inviter?.first_name || "Someone";
  }
  if (invite.invitee_id) {
    const invitee = await getUserById(invite.invitee_id);
    invite.invitee_name =
      invitee?.user_name || invitee?.first_name || "";
  }
  if (!invite.tournament_name) {
    const tournament = await getTournamentById(invite.tournament_id);
    invite.tournament_name = tournament?.Name ?? "";
  }
  return invite;
}

export async function playerOnATeam(
  tournamentId: string,
  userId: string,
): Promise<boolean> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return false;
  const ids = [tournament.TournamentId, tournament._id].filter(Boolean);
  const count = await (
    await registrations()
  ).countDocuments(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byPlayerUserId(userId)],
    }),
  );
  return count > 0;
}

export async function userMayJoinTournament(
  uid: string,
  tournamentId: string,
): Promise<boolean> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return false;
  if (tournament.TournamentType !== "PRIVATE") return true;
  if (await canManageTournamentById(uid, tournamentId)) return true;
  if (tournament.AcceptedInvites.includes(uid)) return true;
  const accepted = await (
    await invites()
  ).findOne({
    tournament_id: tournament.TournamentId,
    $or: [{ invitee_id: uid }, { user_id: uid }],
    status: "ACCEPTED",
  });
  return Boolean(accepted);
}

async function assertPlayerFree(
  tournamentId: string,
  userId: string,
  userName: string,
): Promise<void> {
  if (await playerOnATeam(tournamentId, userId)) {
    throw new ServiceError(`${userName} is already on a team in this event`);
  }
}

async function countRegisteredTeams(tournamentId: string): Promise<number> {
  const ids = await relatedTournamentIds(tournamentId);
  return (await registrations()).countDocuments(
    asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)),
  );
}

function eventIsFull(size: number, registered: number): boolean {
  return size > 0 && registered >= size;
}

async function bounceInvite(
  doc: InviteTournamentDoc,
  message: string,
): Promise<never> {
  await (
    await invites()
  ).updateOne(
    { _id: doc._id },
    { $set: { status: "DECLINED", UpdatedAt: new Date().toISOString() } },
  );
  throw new ServiceError(message);
}

export async function inviteToTournament(
  actorUid: string,
  tournamentId: string,
  usernameOrEmail: string,
): Promise<InviteTournament> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
  if (!(await canManageTournamentById(actorUid, tournamentId))) {
    throw new ServiceError("You are not allowed to invite players to this event");
  }
  if (tournament.Start) {
    throw new ServiceError("Registration is closed");
  }
  if (
    eventIsFull(
      tournament.TournamentSize,
      await countRegisteredTeams(tournament.TournamentId),
    )
  ) {
    throw new ServiceError("Tournament full");
  }

  const invitee = await findUserByHandle(usernameOrEmail);
  if (!invitee) {
    throw new ServiceError("No user found with that username or email");
  }
  if (invitee.user_id === actorUid) {
    throw new ServiceError("You already have access as the host");
  }
  await assertPlayerFree(
    tournament.TournamentId,
    invitee.user_id,
    invitee.user_name,
  );

  const iCol = await invites();
  const existing = await iCol.findOne({
    tournament_id: tournament.TournamentId,
    $and: [
      { $or: [{ invitee_id: invitee.user_id }, { user_id: invitee.user_id }] },
      { $or: [{ kind: "TOURNAMENT" }, { kind: { $exists: false } }] },
      { status: { $nin: ["DECLINED"] } },
    ],
  });
  if (existing) {
    const current = serializeInvite(existing);
    if (current.status === "ACCEPTED") {
      // Host removed them after they joined. The old accept still sits on
      // the invite; reopen it so they can be invited again.
      return reopenTournamentInvite(existing, actorUid, invitee, tournament);
    }
    throw new ServiceError("That player already has a pending invite");
  }

  return insertInvite({
    kind: "TOURNAMENT",
    tournamentId: tournament.TournamentId,
    tournamentName: tournament.Name,
    teamName: "",
    registerId: "",
    inviterId: actorUid,
    invitee,
  });
}

export async function inviteToTeam(
  actorUid: string,
  tournamentId: string,
  usernameOrEmail: string,
): Promise<InviteTournament> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
  if (tournament.Start) {
    throw new ServiceError("Registration is closed");
  }
  const needed = rosterSize(tournament.Team, tournament.RosterCount);
  if (needed < 2) {
    throw new ServiceError("Solo events do not use team invites");
  }

  const rCol = await registrations();
  const ids = [tournament.TournamentId, tournament._id];
  const team = await rCol.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byPlayerUserId(actorUid)],
    }),
  );
  if (!team) {
    throw new ServiceError("Register your team before inviting teammates");
  }
  if (!isCaptain(team, actorUid)) {
    throw new ServiceError("Only the player who registered the team can invite");
  }
  if (team.Players.length >= needed) {
    throw new ServiceError(rosterOverCapMessage(needed));
  }

  const invitee = await findUserByHandle(usernameOrEmail);
  if (!invitee) {
    throw new ServiceError("No user found with that username or email");
  }
  if (invitee.user_id === actorUid) {
    throw new ServiceError("You are already on this team");
  }
  await assertPlayerFree(
    tournament.TournamentId,
    invitee.user_id,
    invitee.user_name,
  );

  const iCol = await invites();
  const pending = await iCol.findOne({
    tournament_id: tournament.TournamentId,
    kind: "TEAM",
    $or: [{ invitee_id: invitee.user_id }, { user_id: invitee.user_id }],
    status: { $nin: ["ACCEPTED", "DECLINED"] },
  });
  if (pending) {
    throw new ServiceError("That player already has a pending team invite");
  }

  if (team.Players.some((p) => p.User_id === invitee.user_id)) {
    throw new ServiceError("That player is already on this team");
  }

  const pendingOnTeam = await iCol.countDocuments({
    register_id: team.RegisterTournamentId,
    kind: "TEAM",
    status: { $nin: ["ACCEPTED", "DECLINED"] },
  });
  if (team.Players.length + pendingOnTeam >= needed) {
    throw new ServiceError(rosterOverCapMessage(needed));
  }

  return insertInvite({
    kind: "TEAM",
    tournamentId: tournament.TournamentId,
    tournamentName: tournament.Name,
    teamName: team.TeamName,
    registerId: team.RegisterTournamentId,
    inviterId: actorUid,
    invitee,
  });
}

async function reopenTournamentInvite(
  doc: InviteTournamentDoc,
  actorUid: string,
  invitee: {
    user_id: string;
    first_name: string;
    user_name: string;
    email: string;
  },
  tournament: { TournamentId: string; Name: string },
): Promise<InviteTournament> {
  const now = new Date().toISOString();
  await (await invites()).updateOne(
    { _id: doc._id },
    {
      $set: {
        status: "PENDING",
        inviter_id: actorUid,
        UpdatedAt: now,
      },
    },
  );
  await (await tournaments()).updateOne(
    asDocFilter(byTournamentId(tournament.TournamentId)),
    {
      $pull: {
        AcceptedInvites: invitee.user_id,
        acceptedinvites: invitee.user_id,
      },
    } as never,
  );
  const next: InviteTournamentDoc = {
    ...doc,
    status: "PENDING",
    inviter_id: actorUid,
    UpdatedAt: now,
  };
  await notifyInvite({
    kind: "TOURNAMENT",
    tournamentId: tournament.TournamentId,
    tournamentName: tournament.Name,
    teamName: "",
    inviteId: next.invite_id,
    invitee,
  });
  return hydrateInvite(next);
}

async function notifyInvite(input: {
  kind: "TOURNAMENT" | "TEAM";
  tournamentId: string;
  tournamentName: string;
  teamName: string;
  inviteId: string;
  invitee: {
    user_id: string;
    first_name: string;
    user_name: string;
    email: string;
  };
}): Promise<void> {
  const message =
    input.kind === "TEAM"
      ? `Join ${input.teamName} in ${input.tournamentName}`
      : `You are invited to ${input.tournamentName}`;
  await createNotification(input.invitee.user_id, message, {
    kind: input.kind === "TEAM" ? "TEAM_INVITE" : "TOURNAMENT_INVITE",
    invite_id: input.inviteId,
    tournament_id: input.tournamentId,
  });
  void sendEmail(
    input.invitee.email,
    input.kind === "TEAM"
      ? teamInviteEmail(
          input.invitee.first_name || input.invitee.user_name,
          input.tournamentId,
          input.tournamentName,
          input.teamName,
        )
      : tournamentInviteEmail(
          input.invitee.first_name || input.invitee.user_name,
          input.tournamentId,
          input.tournamentName,
        ),
  );
}

async function insertInvite(input: {
  kind: "TOURNAMENT" | "TEAM";
  tournamentId: string;
  tournamentName: string;
  teamName: string;
  registerId: string;
  inviterId: string;
  invitee: {
    user_id: string;
    first_name: string;
    user_name: string;
    email: string;
  };
}): Promise<InviteTournament> {
  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: InviteTournamentDoc = {
    _id,
    invite_id: _id.toHexString(),
    kind: input.kind,
    tournament_id: input.tournamentId,
    tournament_name: input.tournamentName,
    team_name: input.teamName,
    register_id: input.registerId,
    inviter_id: input.inviterId,
    invitee_id: input.invitee.user_id,
    user_id: input.invitee.user_id,
    status: "PENDING",
    CreatedAt: now,
    UpdatedAt: now,
  };
  await (await invites()).insertOne(doc);
  await notifyInvite({
    kind: input.kind,
    tournamentId: input.tournamentId,
    tournamentName: input.tournamentName,
    teamName: input.teamName,
    inviteId: doc.invite_id,
    invitee: input.invitee,
  });
  return hydrateInvite(doc);
}

export async function listMyPendingInvites(
  userId: string,
): Promise<InviteTournament[]> {
  const docs = await (await invites())
    .find(pendingForUser(userId))
    .sort({ _id: -1 })
    .limit(50)
    .toArray();
  return Promise.all(docs.map((doc) => hydrateInvite(doc)));
}

export async function listPendingTeamInvites(
  actorUid: string,
  tournamentId: string,
): Promise<InviteTournament[]> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return [];
  const ids = [tournament.TournamentId, tournament._id];
  const team = await (
    await registrations()
  ).findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byPlayerUserId(actorUid)],
    }),
  );
  if (!team || !isCaptain(team, actorUid)) return [];
  const docs = await (await invites())
    .find({
      register_id: team.RegisterTournamentId,
      kind: "TEAM",
      status: { $nin: ["ACCEPTED", "DECLINED"] },
    })
    .sort({ _id: -1 })
    .toArray();
  return Promise.all(docs.map((doc) => hydrateInvite(doc)));
}

export async function listHostTournamentInvites(
  actorUid: string,
  tournamentId: string,
): Promise<InviteTournament[]> {
  if (!(await canManageTournamentById(actorUid, tournamentId))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return [];
  const ids = [tournament.TournamentId, tournament._id].filter(Boolean);
  const docs = await (
    await invites()
  )
    .find({
      tournament_id: { $in: ids },
      $or: [{ kind: "TOURNAMENT" }, { kind: { $exists: false } }],
      status: { $nin: ["ACCEPTED", "DECLINED"] },
    })
    .sort({ _id: -1 })
    .limit(100)
    .toArray();
  return Promise.all(docs.map((doc) => hydrateInvite(doc)));
}

export async function countPendingInvites(userId: string): Promise<number> {
  return (await invites()).countDocuments(pendingForUser(userId));
}

async function loadPendingInvite(
  userId: string,
  inviteId: string,
): Promise<InviteTournamentDoc> {
  const iCol = await invites();
  const byInviteId = await iCol.findOne({
    invite_id: inviteId,
    $or: [{ invitee_id: userId }, { user_id: userId }],
    status: { $nin: ["ACCEPTED", "DECLINED"] },
  });
  if (byInviteId) return byInviteId;
  if (ObjectId.isValid(inviteId)) {
    const byOid = await iCol.findOne({
      _id: new ObjectId(inviteId),
      $or: [{ invitee_id: userId }, { user_id: userId }],
      status: { $nin: ["ACCEPTED", "DECLINED"] },
    });
    if (byOid) return byOid;
  }
  throw new ServiceError("Invite not found");
}

export async function acceptInviteById(
  userId: string,
  inviteId: string,
): Promise<{ tournamentId: string; kind: "TOURNAMENT" | "TEAM" }> {
  await assertCanParticipate(userId);
  const doc = await loadPendingInvite(userId, inviteId);
  const invite = serializeInvite(doc);
  await assertPlayerFree(invite.tournament_id, userId, "You");

  const tournament = await getTournamentById(invite.tournament_id);
  if (!tournament) throw new ServiceError("Tournament not found");

  if (invite.kind === "TEAM") {
    const needed = rosterSize(tournament.Team, tournament.RosterCount);
    const ids = await relatedTournamentIds(invite.tournament_id);
    const rCol = await registrations();
    const team = invite.register_id
      ? await rCol.findOne({
          $or: [
            { RegisterTournamentId: invite.register_id },
            { registertournamentid: invite.register_id },
          ],
        } as never)
      : await rCol.findOne(
          asDocFilter<RegisterTournamentDoc>({
            $and: [byAnyTournamentId(ids), { TeamName: invite.team_name }],
          }),
        );
    const filled = (team?.Players ?? []).length;
    if (!team || filled >= needed) {
      await bounceInvite(doc, rosterOverCapMessage(needed));
    }
    const invitee = await getUserById(userId);
    if (!invitee) throw new ServiceError("User not found");
    try {
      await addPlayerToTeam(invite.tournament_id, invite.team_name, {
        UserName: invitee.user_name || invitee.first_name || "Player",
        GameUserName: "",
        User_id: invitee.user_id,
        Email: invitee.email || "",
        Icon: await playerIconForUser(invitee.user_id),
        Verified: Boolean(invitee.verified),
      });
    } catch (error) {
      if (
        error instanceof ServiceError &&
        /spot|full|at most|cannot have more/i.test(error.message)
      ) {
        await bounceInvite(doc, rosterOverCapMessage(needed));
      }
      throw error;
    }
  } else if (
    eventIsFull(
      tournament.TournamentSize,
      await countRegisteredTeams(invite.tournament_id),
    )
  ) {
    await bounceInvite(doc, "Tournament full");
  }

  const now = new Date().toISOString();
  await (await invites()).updateOne(
    { _id: doc._id },
    { $set: { status: "ACCEPTED", UpdatedAt: now } },
  );
  await (await tournaments()).updateOne(
    asDocFilter(byTournamentId(invite.tournament_id)),
    { $addToSet: { AcceptedInvites: userId } },
  );
  return { tournamentId: invite.tournament_id, kind: invite.kind };
}

export async function declineInviteById(
  userId: string,
  inviteId: string,
): Promise<void> {
  const doc = await loadPendingInvite(userId, inviteId);
  await (await invites()).updateOne(
    { _id: doc._id },
    { $set: { status: "DECLINED", UpdatedAt: new Date().toISOString() } },
  );
}
