import "server-only";
import { ObjectId } from "mongodb";
import { ratings, tournaments } from "@/server/db";
import type { RatingDoc } from "@/server/documents";
import { serializeRating } from "@/server/serialize";
import type {
  Rating,
  RateInput,
  RatingSummary,
  RatingTarget,
} from "@/lib/schemas/rating";
import type { Paginated } from "@/lib/result";
import { ServiceError, getUserById } from "./userService";
import { getOrgById } from "./orgService";
import { getTournamentById } from "./tournamentService";
import { isRatingEnabled } from "./settingsService";

/** Confirms the target exists and returns its display name (and canonical id). */
async function resolveTarget(
  targetType: RatingTarget,
  targetId: string,
): Promise<{ id: string; name: string }> {
  if (targetType === "USER") {
    const user = await getUserById(targetId);
    if (!user) throw new ServiceError("User not found");
    return { id: user.user_id, name: user.user_name };
  }
  if (targetType === "ORG") {
    const org = await getOrgById(targetId);
    if (!org) throw new ServiceError("Organization not found");
    return { id: org.org_id, name: org.name };
  }
  const tournament = await getTournamentById(targetId);
  if (!tournament) throw new ServiceError("Tournament not found");
  return { id: tournament.TournamentId, name: tournament.Name };
}

async function summarize(
  targetType: RatingTarget,
  targetId: string,
): Promise<RatingSummary> {
  const col = await ratings();
  const [row] = await col
    .aggregate<{ avg: number; count: number }>([
      { $match: { TargetType: targetType, TargetId: targetId } },
      { $group: { _id: null, avg: { $avg: "$Stars" }, count: { $sum: 1 } } },
    ])
    .toArray();
  if (!row || !row.count) return { average: 0, count: 0 };
  return { average: Math.round(row.avg * 10) / 10, count: row.count };
}

export async function ratingSummary(
  targetType: RatingTarget,
  targetId: string,
): Promise<RatingSummary> {
  if (!targetId) return { average: 0, count: 0 };
  return summarize(targetType, targetId);
}

export async function getMyRating(
  uid: string,
  targetType: RatingTarget,
  targetId: string,
): Promise<Rating | null> {
  const col = await ratings();
  const doc = await col.findOne({
    TargetType: targetType,
    TargetId: targetId,
    User_id: uid,
  } as never);
  return doc ? serializeRating(doc) : null;
}

export async function listReviews(
  targetType: RatingTarget,
  targetId: string,
  limit = 10,
): Promise<Rating[]> {
  const col = await ratings();
  const docs = await col
    .find({
      TargetType: targetType,
      TargetId: targetId,
      Comment: { $nin: ["", null] },
    } as never)
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
  return docs.map(serializeRating);
}

export async function rate(
  uid: string,
  raterName: string,
  targetType: RatingTarget,
  targetId: string,
  input: RateInput,
): Promise<Rating> {
  if (!(await isRatingEnabled(targetType))) {
    throw new ServiceError("Ratings are turned off for this");
  }
  const target = await resolveTarget(targetType, targetId);
  if (targetType === "USER" && target.id === uid) {
    throw new ServiceError("You cannot rate yourself");
  }

  const col = await ratings();
  const now = new Date().toISOString();
  const existing = await col.findOne({
    TargetType: targetType,
    TargetId: target.id,
    User_id: uid,
  } as never);

  let result: Rating;
  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          Stars: input.Stars,
          Comment: input.Comment ?? "",
          UserName: raterName,
          TargetName: target.name,
          Updated_at: now,
        },
      },
    );
    const updated = await col.findOne({ _id: existing._id });
    result = serializeRating(updated as RatingDoc);
  } else {
    const _id = new ObjectId();
    const doc: RatingDoc = {
      _id,
      RatingId: _id.toHexString(),
      TargetType: targetType,
      TargetId: target.id,
      TargetName: target.name,
      User_id: uid,
      UserName: raterName,
      Stars: input.Stars,
      Comment: input.Comment ?? "",
      Created_at: now,
      Updated_at: now,
    };
    await col.insertOne(doc);
    result = serializeRating(doc);
  }

  // Keep the tournament's denormalized rating fresh so cards do not each query.
  if (targetType === "TOURNAMENT") {
    const summary = await summarize("TOURNAMENT", target.id);
    await (
      await tournaments()
    ).updateOne(
      { $or: [{ TournamentId: target.id }, { tournamentid: target.id }] },
      {
        $set: {
          RatingAvg: summary.average,
          RatingCount: summary.count,
        },
      } as never,
    );
  }

  return result;
}

export async function listRatings(page: number): Promise<Paginated<Rating>> {
  const perPage = 25;
  const safePage = Math.max(page, 1);
  const col = await ratings();
  const total = await col.countDocuments({});
  const docs = await col
    .find({})
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();
  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeRating),
  };
}
