"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  searchPlacesInputSchema,
  type PlaceResult,
} from "@/lib/schemas/place";
import { getSessionClaims } from "@/server/auth/session";
import { searchPlaces } from "@/server/geocode";

/**
 * Venue autocomplete. Signed-in only: the upstream geocoder is rate-limited and
 * shared across the whole app, so anonymous traffic would exhaust it.
 */
export async function searchPlacesAction(
  input: unknown,
): Promise<ActionResult<PlaceResult[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(searchPlacesInputSchema, input);
  if (!parsed.ok) return ok([]);
  try {
    return ok(await searchPlaces(parsed.data.query, parsed.data.country));
  } catch (error) {
    console.error(error);
    return fail("Could not search places right now");
  }
}
