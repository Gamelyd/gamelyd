import "server-only";
import { fail, type Failure } from "@/lib/result";
import {
  canAdministerTournamentById,
  canManageTournamentById,
} from "@/server/services/tournamentService";
import { getSessionClaims } from "./session";

/**
 * Owner or platform admin only. Call this at the top of every tournament
 * manage action so the check is not left to the service layer.
 */
export async function guardManageTournament(
  tournamentId: string,
): Promise<Failure | null> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const allowed = await canManageTournamentById(claims.uid, tournamentId);
  return allowed ? null : fail("You are not allowed to manage this tournament");
}

/** Same as guardManageTournament, but also returns the caller uid on success. */
export async function requireTournamentManager(
  tournamentId: string,
): Promise<{ ok: true; uid: string } | Failure> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const allowed = await canManageTournamentById(claims.uid, tournamentId);
  if (!allowed) return fail("You are not allowed to manage this tournament");
  return { ok: true, uid: claims.uid };
}

/**
 * Owner or platform admin only (co-managers excluded). Use for destructive
 * actions and for managing the co-manager list itself.
 */
export async function requireTournamentAdmin(
  tournamentId: string,
): Promise<{ ok: true; uid: string } | Failure> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const allowed = await canAdministerTournamentById(claims.uid, tournamentId);
  if (!allowed) {
    return fail("Only the tournament owner can do this");
  }
  return { ok: true, uid: claims.uid };
}
