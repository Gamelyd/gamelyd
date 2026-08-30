import "server-only";
import { ObjectId } from "mongodb";
import { joinRequests, registrations } from "@/server/db";
import type { JoinRequestDoc } from "@/server/documents";
import { serializeJoinRequest } from "@/server/serialize";
import type { JoinRequest } from "@/lib/schemas/joinRequest";
import type { RegisterTournamentPayload } from "@/lib/schemas/register";
import { registrationOpen } from "@/lib/tournamentWindow";
import { ServiceError, assertCanParticipate } from "./userService";
import {
  getTournamentById,
  registerForTournament,
  canManageTournamentById,
} from "./tournamentService";
import { createNotification } from "./notificationService";

type JoinRequestInput = Pick<
  RegisterTournamentPayload,
  "TeamName" | "Players" | "Icon"
>;

async function findRequest(requestId: string): Promise<JoinRequestDoc | null> {
  const col = await joinRequests();
  const or: Record<string, unknown>[] = [
    { JoinRequestId: requestId },
    { joinrequestid: requestId },
  ];
  if (ObjectId.isValid(requestId)) or.push({ _id: new ObjectId(requestId) });
  return col.findOne({ $or: or } as never);
}

export async function createJoinRequest(
  uid: string,
  tournamentId: string,
  userName: string,
  input: JoinRequestInput,
): Promise<JoinRequest> {
  await assertCanParticipate(uid);

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
  if (tournament.TournamentType !== "PRIVATE") {
    throw new ServiceError("This tournament does not take join requests");
  }
  if (tournament.Start) {
    throw new ServiceError("This tournament has already started");
  }
  if (!registrationOpen(tournament)) {
    throw new ServiceError("Registration is closed for this tournament");
  }

  const rCol = await registrations();
  const already = await rCol.countDocuments({
    $and: [
      {
        $or: [
          { TournamentId: tournament.TournamentId },
          { tournamentid: tournament.TournamentId },
        ],
      },
      {
        $or: [{ "Players.User_id": uid }, { "players.user_id": uid }],
      },
    ],
  } as never);
  if (already > 0) {
    throw new ServiceError("You are already registered for this tournament");
  }

  const col = await joinRequests();
  const pending = await col.countDocuments({
    $and: [
      {
        $or: [
          { TournamentId: tournament.TournamentId },
          { tournamentid: tournament.TournamentId },
        ],
      },
      { $or: [{ User_id: uid }, { user_id: uid }] },
    ],
  } as never);
  if (pending > 0) {
    throw new ServiceError("You already have a request pending for this event");
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: JoinRequestDoc = {
    _id,
    JoinRequestId: _id.toHexString(),
    TournamentId: tournament.TournamentId,
    User_id: uid,
    UserName: userName,
    TeamName: input.TeamName,
    Players: input.Players,
    Icon: input.Icon,
    Created_at: now,
  };
  await col.insertOne(doc);

  void createNotification(
    tournament.User_id,
    `${input.TeamName} requested to join ${tournament.Name}`,
    { kind: "GENERIC", tournament_id: tournament.TournamentId },
  );

  return serializeJoinRequest(doc);
}

export async function listJoinRequests(
  tournamentId: string,
): Promise<JoinRequest[]> {
  const tournament = await getTournamentById(tournamentId);
  const key = tournament?.TournamentId ?? tournamentId;
  const col = await joinRequests();
  const docs = await col
    .find({ $or: [{ TournamentId: key }, { tournamentid: key }] } as never)
    .sort({ _id: -1 })
    .toArray();
  return docs.map(serializeJoinRequest);
}

export async function acceptJoinRequest(
  requestId: string,
  actorUid: string,
): Promise<void> {
  const doc = await findRequest(requestId);
  if (!doc) throw new ServiceError("Request not found");
  if (!(await canManageTournamentById(actorUid, doc.TournamentId))) {
    throw new ServiceError("You cannot manage this tournament");
  }

  await registerForTournament(
    doc.TournamentId,
    {
      TeamName: doc.TeamName,
      Players: doc.Players,
      Icon: doc.Icon,
      RefNumber: "",
      PaymentChannel: "",
      Amount: 0,
    },
    { actorUid: doc.User_id, skipInviteGate: true, allowPartialRoster: true },
  );

  const col = await joinRequests();
  await col.deleteOne({ _id: doc._id });

  const tournament = await getTournamentById(doc.TournamentId);
  void createNotification(
    doc.User_id,
    `Your request to join ${tournament?.Name ?? "a tournament"} was accepted. You are registered.`,
    { kind: "GENERIC", tournament_id: doc.TournamentId },
  );
}

export async function declineJoinRequest(
  requestId: string,
  actorUid: string,
): Promise<void> {
  const doc = await findRequest(requestId);
  if (!doc) throw new ServiceError("Request not found");
  if (!(await canManageTournamentById(actorUid, doc.TournamentId))) {
    throw new ServiceError("You cannot manage this tournament");
  }
  const col = await joinRequests();
  await col.deleteOne({ _id: doc._id });

  const tournament = await getTournamentById(doc.TournamentId);
  void createNotification(
    doc.User_id,
    `Your request to join ${tournament?.Name ?? "a tournament"} was declined.`,
    { kind: "GENERIC", tournament_id: doc.TournamentId },
  );
}
