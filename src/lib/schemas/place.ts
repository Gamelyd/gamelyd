import { z } from "zod";

/**
 * A place the host picked from search results. Carrying the coordinates with
 * the selection means the saved venue is the one they actually confirmed,
 * rather than whatever a blind re-geocode of the text happens to return.
 */
export const placeResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  name: z.string().default(""),
  city: z.string().default(""),
  country: z.string().max(2).default(""),
  lat: z.number(),
  lng: z.number(),
});
export type PlaceResult = z.infer<typeof placeResultSchema>;

export const searchPlacesInputSchema = z.object({
  query: z.string().trim().min(3, "Type at least 3 characters").max(160),
  country: z.string().max(2).optional().default(""),
});
export type SearchPlacesInput = z.infer<typeof searchPlacesInputSchema>;
