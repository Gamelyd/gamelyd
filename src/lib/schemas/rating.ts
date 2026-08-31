import { z } from "zod";

export const ratingTargetSchema = z.enum(["USER", "ORG", "TOURNAMENT"]);
export type RatingTarget = z.infer<typeof ratingTargetSchema>;

export const ratingSchema = z.object({
  RatingId: z.string(),
  TargetType: ratingTargetSchema,
  TargetId: z.string(),
  TargetName: z.string().default(""),
  User_id: z.string(),
  UserName: z.string().default(""),
  Stars: z.number().int().min(1).max(5),
  Comment: z.string().default(""),
  Created_at: z.string(),
  Updated_at: z.string(),
});
export type Rating = z.infer<typeof ratingSchema>;

export const rateInputSchema = z.object({
  Stars: z.coerce.number().int().min(1).max(5),
  Comment: z.string().max(1000).optional().default(""),
});
export type RateInput = z.infer<typeof rateInputSchema>;

/** Aggregate rating for a target. */
export interface RatingSummary {
  average: number;
  count: number;
}
