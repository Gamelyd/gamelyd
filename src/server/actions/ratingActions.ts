"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import {
  rateInputSchema,
  ratingTargetSchema,
  type Rating,
  type RatingSummary,
  type RatingTarget,
} from "@/lib/schemas/rating";
import { getSessionClaims } from "@/server/auth/session";
import { guardAdmin } from "@/server/auth/admin";
import { ServiceError, getUserById } from "@/server/services/userService";
import {
  isRatingEnabled,
  getRatingSettings,
} from "@/server/services/settingsService";
import {
  rate,
  getMyRating,
  ratingSummary,
  listReviews,
  listRatings,
} from "@/server/services/ratingService";

export type RatingBoard = {
  enabled: boolean;
  summary: RatingSummary;
  mine: Rating | null;
  reviews: Rating[];
};

function parseTarget(value: string): RatingTarget | null {
  const parsed = ratingTargetSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function rateAction(
  targetType: string,
  targetId: string,
  input: unknown,
): Promise<ActionResult<Rating>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in to rate");
  const target = parseTarget(targetType);
  if (!target) return fail("Unknown rating target");
  const parsed = parseInput(rateInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    const user = await getUserById(claims.uid);
    const data = await rate(
      claims.uid,
      user?.user_name ?? "",
      target,
      targetId,
      parsed.data,
    );
    return ok(data, "Thanks for rating");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not save your rating");
  }
}

export async function ratingBoardAction(
  targetType: string,
  targetId: string,
): Promise<ActionResult<RatingBoard>> {
  const target = parseTarget(targetType);
  if (!target) return fail("Unknown rating target");
  try {
    const claims = await getSessionClaims();
    const [enabled, summary, reviews, mine] = await Promise.all([
      isRatingEnabled(target),
      ratingSummary(target, targetId),
      listReviews(target, targetId),
      claims ? getMyRating(claims.uid, target, targetId) : Promise.resolve(null),
    ]);
    return ok({ enabled, summary, mine, reviews });
  } catch {
    return fail("Could not load ratings");
  }
}

export async function ratingSettingsAction(): Promise<
  ActionResult<{ user: boolean; org: boolean; tournament: boolean }>
> {
  try {
    return ok(await getRatingSettings());
  } catch {
    return fail("Could not load settings");
  }
}

export async function adminListRatingsAction(
  page = 1,
): Promise<ActionResult<Paginated<Rating>>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    return ok(await listRatings(page));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Could not load ratings");
  }
}
