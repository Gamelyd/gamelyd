import { z } from "zod";

export const platformSchema = z.object({
  _id: z.string(),
  platform_id: z.string(),
  name: z.string(),
  active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string().default(""),
});
export type Platform = z.infer<typeof platformSchema>;

export const createPlatformInputSchema = z.object({
  name: z.string().min(1).max(80),
  active: z.boolean().optional().default(true),
});
export type CreatePlatformInput = z.infer<typeof createPlatformInputSchema>;

export const updatePlatformInputSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  active: z.boolean().optional(),
});
export type UpdatePlatformInput = z.infer<typeof updatePlatformInputSchema>;
