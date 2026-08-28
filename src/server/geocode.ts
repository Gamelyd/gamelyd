import "server-only";
import { countryName } from "@/lib/countries";

export type GeoPoint = { lat: number; lng: number };

/**
 * Look up a venue with OpenStreetMap Nominatim. Returns null if it cannot
 * resolve. Callers still save the typed country and address.
 */
export async function geocodeVenue(
  location: string,
  countryCode: string,
): Promise<GeoPoint | null> {
  const q = location.trim();
  if (!q) return null;
  const params = new URLSearchParams({
    q: countryCode ? `${q}, ${countryName(countryCode) || countryCode}` : q,
    format: "jsonv2",
    limit: "1",
  });
  if (countryCode) params.set("countrycodes", countryCode.toLowerCase());
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Gamelyd/1.0 (https://www.gamelyd.co)",
        },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat?: string; lon?: string }[];
    const lat = Number(rows[0]?.lat);
    const lng = Number(rows[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
