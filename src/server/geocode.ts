import "server-only";
import { countryName } from "@/lib/countries";
import type { PlaceResult } from "@/lib/schemas/place";

export type GeoPoint = { lat: number; lng: number };

const NOMINATIM = "https://nominatim.openstreetmap.org";

/** Nominatim asks every caller to identify itself and rate-limits anonymous use. */
const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Gamelyd/1.0 (https://www.gamelyd.com)",
};

interface NominatimRow {
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  address?: Record<string, string | undefined>;
}

function toPlace(row: NominatimRow): PlaceResult | null {
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const label = (row.display_name ?? "").trim();
  if (!label) return null;

  const address = row.address ?? {};
  // Nominatim spreads the settlement across several keys depending on the
  // place's size, so fall back through them in order of specificity.
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state ||
    "";

  return {
    id: `${row.osm_type ?? "n"}:${row.osm_id ?? label}`,
    label,
    name: (row.name || label.split(",")[0] || "").trim(),
    city,
    country: (address.country_code ?? "").toUpperCase(),
    lat,
    lng,
  };
}

/**
 * Free-text place search for the venue picker. Returns several candidates so
 * the host confirms which one they meant, rather than us silently guessing.
 */
export async function searchPlaces(
  query: string,
  countryCode = "",
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
  });
  if (countryCode) params.set("countrycodes", countryCode.toLowerCase());

  try {
    const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
      // Identical searches are common while typing; let Next reuse them.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as NominatimRow[];
    const seen = new Set<string>();
    return rows
      .map(toPlace)
      .filter((place): place is PlaceResult => place !== null)
      .filter((place) => {
        if (seen.has(place.id)) return false;
        seen.add(place.id);
        return true;
      });
  } catch {
    return [];
  }
}

/**
 * Single best match, used as a fallback when a host typed a place but never
 * picked one from the search results.
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
    const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as NominatimRow[];
    const lat = Number(rows[0]?.lat);
    const lng = Number(rows[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
