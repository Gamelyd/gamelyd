import type { Payment } from "@/lib/schemas/common";
import type { PrizePosition } from "@/lib/schemas/tournament";
import { roundMoney, splitEntry } from "@/lib/fees";

/**
 * Both paid and sponsored events now advertise fixed cash prizes. The
 * difference is where the money comes from: a sponsor deposits it up front,
 * while a paid event collects it from entry fees.
 *
 * `Share` is retained only for paid tournaments created before this change,
 * which split the net pot by percentage. Those keep settling the old way.
 */
export function usesLegacyShares(prizes: PrizePosition[]): boolean {
  return (
    prizes.length > 0 &&
    prizes.every((p) => (p.Amount || 0) <= 0) &&
    prizes.some((p) => (p.Share || 0) > 0)
  );
}

/** Total cash the board promises. */
export function prizeBoardTotal(prizes: PrizePosition[]): number {
  return roundMoney(prizes.reduce((sum, p) => sum + (p.Amount || 0), 0));
}

/**
 * The most a paid event could ever hold: a full house of entry fees, minus the
 * platform fee. A board above this can never be paid, however well it sells.
 */
export function maxNetPot(
  entryFee: number,
  teamCount: number,
  feeBps?: number,
): number {
  if (entryFee <= 0 || teamCount <= 0) return 0;
  return roundMoney(splitEntry(entryFee, feeBps).net * teamCount);
}

/** How many paid teams it takes before the board is fully covered. */
export function teamsNeededForBoard(
  boardTotal: number,
  entryFee: number,
  feeBps?: number,
): number {
  if (boardTotal <= 0) return 0;
  const perTeam = splitEntry(entryFee, feeBps).net;
  if (perTeam <= 0) return 0;
  return Math.ceil(boardTotal / perTeam);
}

/**
 * Splits a pot across a board, paying positions in order and never promising
 * more than the money actually held. Returns what each place gets plus the
 * remainder that returns to the host.
 */
export function allocateBoard(
  prizes: PrizePosition[],
  pot: number,
  payment: Payment,
): { byPosition: Map<number, number>; remaining: number } {
  const byPosition = new Map<number, number>();
  let remaining = roundMoney(pot);
  const legacy = payment === "PAID" && usesLegacyShares(prizes);

  for (const prize of [...prizes].sort((a, b) => a.Position - b.Position)) {
    const wanted = legacy
      ? roundMoney((pot * (prize.Share || 0)) / 100)
      : roundMoney(prize.Amount || 0);
    if (wanted <= 0) continue;
    // A shortfall (refund, chargeback, an event that started underfilled)
    // must never create payouts the pot cannot cover.
    const paid = roundMoney(Math.min(wanted, Math.max(remaining, 0)));
    if (paid <= 0) continue;
    byPosition.set(prize.Position, paid);
    remaining = roundMoney(remaining - paid);
  }
  return { byPosition, remaining: Math.max(remaining, 0) };
}
