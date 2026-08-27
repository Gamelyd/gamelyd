import type { Draw } from "@/lib/schemas/draw";

export function isThirdPlaceDraw(draw: {
  Kind?: string;
}): boolean {
  return draw.Kind === "THIRD_PLACE";
}

export function isBrDraw(draw: { BRTeams?: unknown[] }): boolean {
  return (draw.BRTeams?.length ?? 0) > 0;
}

export function isGroupDraw(draw: {
  Group?: string;
  Kind?: string;
  BRTeams?: unknown[];
}): boolean {
  return Boolean(draw.Group?.trim()) && !isThirdPlaceDraw(draw) && !isBrDraw(draw);
}

export function isKnockoutDraw(draw: {
  Group?: string;
  Kind?: string;
  BRTeams?: unknown[];
}): boolean {
  return !isGroupDraw(draw) && !isBrDraw(draw) && !isThirdPlaceDraw(draw);
}

export function knockoutGames(draws: Draw[]): Draw[] {
  return draws.filter(isKnockoutDraw);
}

export function thirdPlaceGames(draws: Draw[]): Draw[] {
  return draws.filter(isThirdPlaceDraw);
}
