import { z } from "zod";

export const scoreLabelSchema = z.enum(["Goals", "Points"]);
export type ScoreLabel = z.infer<typeof scoreLabelSchema>;

export const catalogFormatSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  roster: z.coerce.number().int().min(1).max(32),
});
export type CatalogFormat = z.infer<typeof catalogFormatSchema>;

export const gameSchema = z.object({
  _id: z.string(),
  game_id: z.string(),
  name: z.string(),
  image: z.string().default(""),
  platforms: z.array(z.string()).default([]),
  kind: z.string().default("games"),
  formats: z.array(catalogFormatSchema).default([]),
  allowDraw: z.boolean().default(true),
  scoreLabel: scoreLabelSchema.default("Goals"),
  active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string().default(""),
});
export type Game = z.infer<typeof gameSchema>;

export const createGameInputSchema = z.object({
  name: z.string().min(1).max(100),
  image: z.string().max(500).optional().default(""),
  platforms: z.array(z.string()).optional().default([]),
  kind: z.string().min(1).max(40).optional().default("games"),
  formats: z.array(catalogFormatSchema).optional().default([]),
  allowDraw: z.boolean().optional().default(true),
  scoreLabel: scoreLabelSchema.optional().default("Goals"),
  active: z.boolean().optional().default(true),
});
export type CreateGameInput = z.infer<typeof createGameInputSchema>;

export const updateGameInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().max(500).optional(),
  platforms: z.array(z.string()).optional(),
  kind: z.string().min(1).max(40).optional(),
  formats: z.array(catalogFormatSchema).optional(),
  allowDraw: z.boolean().optional(),
  scoreLabel: scoreLabelSchema.optional(),
  active: z.boolean().optional(),
});
export type UpdateGameInput = z.infer<typeof updateGameInputSchema>;
