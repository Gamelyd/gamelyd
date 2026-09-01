import type { Draw } from "@/lib/schemas/draw";
import { isGroupDraw, isKnockoutDraw } from "@/lib/drawKind";

/**
 * A fixture is locked once the tournament has moved past it:
 * - a knockout match once a later knockout round has been drawn, and
 * - a group match once the knockout stage exists.
 * League and battle-royale stages are all generated at once, so they are not
 * stage-locked (only a finished tournament freezes them).
 */
export function isFixtureStageLocked(draw: Draw, draws: Draw[]): boolean {
  if (isKnockoutDraw(draw)) {
    const maxKnockoutStage = Math.max(
      ...draws.filter(isKnockoutDraw).map((d) => d.Stage),
    );
    return draw.Stage < maxKnockoutStage;
  }
  if (isGroupDraw(draw)) {
    return draws.some(isKnockoutDraw);
  }
  return false;
}
