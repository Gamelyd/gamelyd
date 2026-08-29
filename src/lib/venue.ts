import { countryName, parseCountryCode } from "@/lib/countries";

export const NEAR_RADIUS_OPTIONS = [
  { label: "25 km", value: "25" },
  { label: "50 km", value: "50" },
  { label: "100 km", value: "100" },
  { label: "250 km", value: "250" },
] as const;

export const DEFAULT_NEAR_KM = 50;

export type BrowseLocation = {
  country: string;
  place: string;
  lat: number | null;
  lng: number | null;
  radius: number;
};

export const EMPTY_BROWSE_LOCATION: BrowseLocation = {
  country: "",
  place: "",
  lat: null,
  lng: null,
  radius: DEFAULT_NEAR_KM,
};

function parseCoord(raw: string | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseBrowseLocation(sp: {
  country?: string;
  place?: string;
  lat?: string;
  lng?: string;
  radius?: string;
}): BrowseLocation {
  const lat = parseCoord(sp.lat);
  const lng = parseCoord(sp.lng);
  const radius = Number(sp.radius);
  const nearOk =
    lat != null &&
    lng != null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  return {
    country: parseCountryCode(sp.country),
    place: String(sp.place ?? "").trim().slice(0, 80),
    lat: nearOk ? lat : null,
    lng: nearOk ? lng : null,
    radius:
      Number.isFinite(radius) && radius >= 5 && radius <= 500
        ? Math.round(radius)
        : DEFAULT_NEAR_KM,
  };
}

export function venueMapsUrl(v: {
  country?: string;
  location?: string;
  lat?: number;
  lng?: number;
}): string | undefined {
  if (v.lat && v.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${v.lat},${v.lng}`,
    )}`;
  }
  const q = formatVenueRow(v);
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : undefined;
}

export function formatVenueRow(v: {
  country?: string;
  location?: string;
}): string {
  const place = (v.location ?? "").trim();
  const country = countryName(v.country ?? "");
  if (place && country) return `${place} · ${country}`;
  return place || country;
}

export function locationLabel(t: {
  VenueCity?: string;
  VenueLocation?: string;
  VenueCountry?: string;
  Venues?: { country?: string; location?: string }[];
}): string {
  const city = eventCity(t);
  return formatVenueRow({ country: t.VenueCountry, location: city });
}

export function eventCity(t: {
  VenueCity?: string;
  VenueLocation?: string;
  Venues?: { country?: string; location?: string }[];
}): string {
  const city = (t.VenueCity ?? "").trim();
  if (city) return city;
  if (t.Venues && t.Venues.length > 0) return "";
  return (t.VenueLocation ?? "").trim();
}

export function venuesOf(t: {
  Venues?: { country?: string; location?: string; lat?: number; lng?: number }[];
  VenueLocation?: string;
  VenueCountry?: string;
  VenueLat?: number;
  VenueLng?: number;
}): { country: string; location: string; lat: number; lng: number }[] {
  if (t.Venues && t.Venues.length > 0) {
    return t.Venues.map((row) => ({
      country: (row.country ?? "").toUpperCase(),
      location: (row.location ?? "").trim(),
      lat: row.lat ?? 0,
      lng: row.lng ?? 0,
    })).filter((row) => row.location);
  }
  return [];
}

export function venueLabel(t: {
  Venues?: { country?: string; location?: string }[];
  VenueCity?: string;
  VenueLocation?: string;
  VenueCountry?: string;
}): string {
  const country = (t.VenueCountry ?? "").trim().toUpperCase();
  const city = eventCity(t);
  const loc = formatVenueRow({ country, location: city });
  const parts: string[] = [];
  const seen = new Set<string>();
  const push = (part: string) => {
    const clean = part.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    parts.push(clean);
  };
  push(loc);
  for (const row of venuesOf(t)) {
    const rowCountry = (row.country || country).toUpperCase();
    if (country && rowCountry === country && (city || loc)) {
      push(row.location);
    } else {
      push(formatVenueRow(row));
    }
  }
  return parts.join(" · ");
}

export function nearestVenueKm(
  t: {
    Venues?: { country?: string; location?: string; lat?: number; lng?: number }[];
    VenueLocation?: string;
    VenueCountry?: string;
    VenueLat?: number;
    VenueLng?: number;
  },
  from: { lat: number; lng: number },
): number | null {
  const points = [
    ...venuesOf(t).filter((row) => row.lat && row.lng),
    ...(t.VenueLat && t.VenueLng
      ? [{ lat: t.VenueLat, lng: t.VenueLng }]
      : []),
  ];
  if (points.length === 0) return null;
  return Math.min(
    ...points.map((row) => haversineKm(from, { lat: row.lat, lng: row.lng })),
  );
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Map pins for an event: its named venues when it has any, otherwise the event
 * location itself. Only places with real coordinates can be pinned, so a venue
 * the host typed but never picked from search is skipped.
 */
export function mapPinsOf(t: {
  Name?: string;
  Venues?: { country?: string; location?: string; lat?: number; lng?: number }[];
  VenueCity?: string;
  VenueLocation?: string;
  VenueCountry?: string;
  VenueLat?: number;
  VenueLng?: number;
}): { label: string; country: string; lat: number; lng: number }[] {
  const country = (t.VenueCountry ?? "").trim().toUpperCase();

  const venues = venuesOf(t)
    .filter((row) => row.lat !== 0 || row.lng !== 0)
    .map((row) => ({
      label: row.location,
      country: row.country || country,
      lat: row.lat,
      lng: row.lng,
    }));
  if (venues.length > 0) return venues;

  const lat = t.VenueLat ?? 0;
  const lng = t.VenueLng ?? 0;
  if (lat === 0 && lng === 0) return [];
  const label = locationLabel(t) || eventCity(t);
  return label ? [{ label, country, lat, lng }] : [];
}
