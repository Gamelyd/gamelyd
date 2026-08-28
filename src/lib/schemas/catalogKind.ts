import { z } from "zod";

export const catalogKindSlugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const catalogKindSchema = z.object({
  _id: z.string(),
  kind_id: z.string(),
  slug: catalogKindSlugSchema,
  label: z.string().min(1).max(40),
  usesPlatforms: z.boolean().default(true),
  usesBattleRoyale: z.boolean().default(true),
  usesInGameName: z.boolean().default(true),
  usesVenue: z.boolean().default(false),
  sort: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string().default(""),
});
export type CatalogKind = z.infer<typeof catalogKindSchema>;

export const createCatalogKindInputSchema = z.object({
  slug: catalogKindSlugSchema,
  label: z.string().min(1).max(40),
  usesPlatforms: z.boolean().optional().default(false),
  usesBattleRoyale: z.boolean().optional().default(false),
  usesInGameName: z.boolean().optional().default(false),
  usesVenue: z.boolean().optional().default(false),
});
export type CreateCatalogKindInput = z.infer<typeof createCatalogKindInputSchema>;

export const updateCatalogKindInputSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  usesPlatforms: z.boolean().optional(),
  usesBattleRoyale: z.boolean().optional(),
  usesInGameName: z.boolean().optional(),
  usesVenue: z.boolean().optional(),
});
export type UpdateCatalogKindInput = z.infer<typeof updateCatalogKindInputSchema>;
