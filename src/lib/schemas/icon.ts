import { z } from "zod";

export const iconKindSchema = z.enum(["tournament", "team", "player"]);
export type IconKind = z.infer<typeof iconKindSchema>;

export const iconAssetSchema = z.object({
  _id: z.string(),
  icon_id: z.string(),
  slug: z.string(),
  kind: iconKindSchema,
  name: z.string(),
  url: z.string(),
  gameIds: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string().default(""),
});
export type IconAsset = z.infer<typeof iconAssetSchema>;

export const createIconInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (value) =>
        value.startsWith("/") ||
        value.startsWith("http://") ||
        value.startsWith("https://"),
      "Use a site path or a full image URL",
    ),
  kind: iconKindSchema,
  gameIds: z.array(z.string()).optional().default([]),
});
export type CreateIconInput = z.infer<typeof createIconInputSchema>;

export const updateIconInputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (value) =>
        value.startsWith("/") ||
        value.startsWith("http://") ||
        value.startsWith("https://"),
      "Use a site path or a full image URL",
    )
    .optional(),
  kind: iconKindSchema.optional(),
  gameIds: z.array(z.string()).optional(),
});
export type UpdateIconInput = z.infer<typeof updateIconInputSchema>;

export const listIconsInputSchema = z.object({
  kind: iconKindSchema.optional(),
  gameId: z.string().optional(),
  search: z.string().optional(),
  includeArchived: z.boolean().optional().default(false),
});
export type ListIconsInput = z.infer<typeof listIconsInputSchema>;
