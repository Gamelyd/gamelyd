/**
 * The captain is the player who registered the team. They pay the entry fee,
 * invite teammates, and are the single person prize money is paid to.
 *
 * New registrations store `CaptainUserId`. Documents written before that field
 * existed fall back to the first player, which was the implicit convention the
 * whole codebase already relied on.
 */
export interface CaptainCarrier {
  CaptainUserId?: string;
  Players?: { User_id: string }[];
}

export function captainUserId(team: CaptainCarrier | null | undefined): string {
  const explicit = team?.CaptainUserId?.trim();
  if (explicit) return explicit;
  return team?.Players?.[0]?.User_id ?? "";
}

export function isCaptain(
  team: CaptainCarrier | null | undefined,
  userId: string | undefined | null,
): boolean {
  if (!userId) return false;
  return captainUserId(team) === userId;
}
