import type { Draw } from "@/lib/schemas/draw";
import { isGroupDraw, isKnockoutDraw } from "@/lib/drawKind";

/**
 * A fixture is locked once the tournament has moved past it.
 *
 * Only group matches are: the knockout is drawn from the final tables, so a
 * changed group result would mean different qualifiers. A knockout result can
 * always be corrected -- the matches drawn from it are redrawn from the new
 * winner, which is handled when the score is saved.
 */
export function isFixtureStageLocked(draw: Draw, draws: Draw[]): boolean {
  if (isKnockoutDraw(draw)) return false;
  if (isGroupDraw(draw)) return draws.some(isKnockoutDraw);
  return false;
}
