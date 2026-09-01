import "server-only";
import { fail, type Failure } from "@/lib/result";
import {
  canAdministerTournamentById,
  canManageTournamentById,
  tournamentIsFinished,
} from "@/server/services/tournamentService";
import { getSessionClaims } from "./session";

type GuardOpts = { allowFinished?: boolean };

const FINISHED = "This tournament has finished, so it is view-only now";

/**
 * Owner or platform admin only. Call this at the top of every tournament
 * manage action so the check is not left to the service layer. A finished
 * tournament is frozen unless `allowFinished` is set (delete, suspend).
 */
export async function guardManageTournament(
  tournamentId: string,
  opts?: GuardOpts,
): Promise<Failure | null> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const allowed = await canManageTournamentById(claims.uid, tournamentId);
  if (!allowed) return fail("You are not allowed to manage this tournament");
  if (!opts?.allowFinished && (await tournamentIsFinished(tournamentId))) {
    return fail(FINISHED);
  }
  return null;
}

/** Same as guardManageTournament, but also returns the caller uid on success. */
export async function requireTournamentManager(
  tournamentId: string,
  opts?: GuardOpts,
): Promise<{ ok: true; uid: string } | Failure> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const allowed = await canManageTournamentById(claims.uid, tournamentId);
  if (!allowed) return fail("You are not allowed to manage this tournament");
  if (!opts?.allowFinished && (await tournamentIsFinished(tournamentId))) {
    return fail(FINISHED);
  }
  return { ok: true, uid: claims.uid };
}

/**
 * Owner or platform admin only (co-managers excluded). Use for destructive
 * actions and for managing the co-manager list itself.
 */
export async function requireTournamentAdmin(
  tournamentId: string,
  opts?: GuardOpts,
): Promise<{ ok: true; uid: string } | Failure> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const allowed = await canAdministerTournamentById(claims.uid, tournamentId);
  if (!allowed) {
    return fail("Only the tournament owner can do this");
  }
  if (!opts?.allowFinished && (await tournamentIsFinished(tournamentId))) {
    return fail(FINISHED);
  }
  return { ok: true, uid: claims.uid };
}
