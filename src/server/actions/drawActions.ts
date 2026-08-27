"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Failure } from "@/lib/result";
import {
  addLinkInputSchema,
  addScoreInputSchema,
  addTimeInputSchema,
  addWinnerInputSchema,
  newDrawInputSchema,
  updateBrDrawInputSchema,
  type Draw,
} from "@/lib/schemas/draw";
import { advanceGroupStageInputSchema } from "@/lib/schemas/tournament";
import {
  addLink,
  addScore,
  addTime,
  addWinner,
  advanceGroupStage,
  drawBr,
  drawGroupStage,
  drawKnockoutNext,
  drawLeague,
  getDrawsByTournament,
  getDrawTournamentId,
  newDraw,
  updateBrDraw,
} from "@/server/services/drawService";
import { ServiceError } from "@/server/services/userService";
import { guardManageTournament } from "@/server/auth/tournament";

/** Ensures the caller can manage the given tournament. */
async function guardTournament(tournamentId: string): Promise<Failure | null> {
  return guardManageTournament(tournamentId);
}

/** Ensures the caller can manage the tournament that owns the given draw. */
async function guardDraw(drawId: string): Promise<Failure | null> {
  const tournamentId = await getDrawTournamentId(drawId);
  if (!tournamentId) return fail("Draw not found");
  return guardTournament(tournamentId);
}

export async function newDrawAction(
  input: unknown,
): Promise<ActionResult<Draw[]>> {
  const parsed = parseInput(newDrawInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  const denied = await guardTournament(parsed.data.TournamentId);
  if (denied) return denied;
  try {
    return ok(await newDraw(parsed.data.TournamentId), "Draw created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong creating the draw");
  }
}

export async function drawBrAction(
  input: unknown,
): Promise<ActionResult<Draw[]>> {
  const parsed = parseInput(newDrawInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  const denied = await guardTournament(parsed.data.TournamentId);
  if (denied) return denied;
  try {
    return ok(await drawBr(parsed.data.TournamentId), "Draw created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong creating the draw");
  }
}

export async function drawLeagueAction(
  input: unknown,
): Promise<ActionResult<Draw[]>> {
  const parsed = parseInput(newDrawInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  const denied = await guardTournament(parsed.data.TournamentId);
  if (denied) return denied;
  try {
    return ok(await drawLeague(parsed.data.TournamentId), "League started");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong starting the league");
  }
}

export async function drawGroupStageAction(
  input: unknown,
): Promise<ActionResult<Draw[]>> {
  const parsed = parseInput(newDrawInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  const denied = await guardTournament(parsed.data.TournamentId);
  if (denied) return denied;
  try {
    return ok(
      await drawGroupStage(parsed.data.TournamentId),
      "Group fixtures drawn",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong drawing group fixtures");
  }
}

export async function advanceGroupStageAction(
  tournamentId: string,
  input: unknown,
): Promise<ActionResult<Draw[]>> {
  const denied = await guardTournament(tournamentId);
  if (denied) return denied;

  const parsed = parseInput(advanceGroupStageInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await advanceGroupStage(tournamentId, parsed.data),
      "Knockout stage drawn",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong advancing the group stage");
  }
}

export async function drawKnockoutNextAction(
  input: unknown,
): Promise<ActionResult<Draw[]>> {
  const parsed = parseInput(newDrawInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  const denied = await guardTournament(parsed.data.TournamentId);
  if (denied) return denied;
  try {
    return ok(
      await drawKnockoutNext(parsed.data.TournamentId),
      "Next knockout round drawn",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong drawing the next round");
  }
}

export async function getDrawsAction(
  tournamentId: string,
): Promise<ActionResult<Draw[]>> {
  return ok(await getDrawsByTournament(tournamentId));
}

export async function addWinnerAction(
  drawId: string,
  input: unknown,
): Promise<ActionResult<Draw>> {
  const denied = await guardDraw(drawId);
  if (denied) return denied;
  const parsed = parseInput(addWinnerInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await addWinner(drawId, parsed.data.Winner));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function addTimeAction(
  drawId: string,
  input: unknown,
): Promise<ActionResult<Draw>> {
  const denied = await guardDraw(drawId);
  if (denied) return denied;
  const parsed = parseInput(addTimeInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await addTime(drawId, parsed.data), "Match time set");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function addScoreAction(
  drawId: string,
  input: unknown,
): Promise<ActionResult<Draw>> {
  const denied = await guardDraw(drawId);
  if (denied) return denied;
  const parsed = parseInput(addScoreInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await addScore(drawId, parsed.data), "Score saved");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function addLinkAction(
  drawId: string,
  input: unknown,
): Promise<ActionResult<Draw>> {
  const denied = await guardDraw(drawId);
  if (denied) return denied;
  const parsed = parseInput(addLinkInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await addLink(drawId, parsed.data.Link), "Link saved");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function updateBrDrawAction(
  drawId: string,
  input: unknown,
): Promise<ActionResult<Draw>> {
  const denied = await guardDraw(drawId);
  if (denied) return denied;
  const parsed = parseInput(updateBrDrawInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await updateBrDraw(drawId, parsed.data), "Draw updated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}
