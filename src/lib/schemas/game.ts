import { z } from "zod";

export const gameSchema = z.object({
  _id: z.string(),
  game_id: z.string(),
  name: z.string(),
  image: z.string().default(""),
  platforms: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string().default(""),
});
export type Game = z.infer<typeof gameSchema>;

export const createGameInputSchema = z.object({
  name: z.string().min(1).max(100),
  image: z.string().max(500).optional().default(""),
  platforms: z.array(z.string()).optional().default([]),
  active: z.boolean().optional().default(true),
});
export type CreateGameInput = z.infer<typeof createGameInputSchema>;

export const updateGameInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().max(500).optional(),
  platforms: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});
export type UpdateGameInput = z.infer<typeof updateGameInputSchema>;
