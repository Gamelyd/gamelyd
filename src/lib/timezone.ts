/**
 * A curated, static list of common IANA timezones for the host to pick from.
 * Static so server and client render the exact same options (no hydration
 * mismatch, unlike Intl-derived lists). The host's own zone is added on top of
 * this at runtime when it is not already here.
 */
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Africa/Lagos", label: "Lagos, Abuja (West Africa)" },
  { value: "Africa/Accra", label: "Accra (Ghana)" },
  { value: "Africa/Nairobi", label: "Nairobi (East Africa)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (South Africa)" },
  { value: "Africa/Cairo", label: "Cairo (Egypt)" },
  { value: "Europe/London", label: "London, Dublin (UK)" },
  { value: "Europe/Lisbon", label: "Lisbon (Portugal)" },
  { value: "Europe/Paris", label: "Paris, Berlin, Madrid (Central Europe)" },
  { value: "Europe/Athens", label: "Athens, Bucharest (Eastern Europe)" },
  { value: "Europe/Moscow", label: "Moscow" },
  { value: "America/New_York", label: "New York, Toronto (US Eastern)" },
  { value: "America/Chicago", label: "Chicago (US Central)" },
  { value: "America/Denver", label: "Denver (US Mountain)" },
  { value: "America/Los_Angeles", label: "Los Angeles (US Pacific)" },
  { value: "America/Sao_Paulo", label: "Sao Paulo (Brazil)" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "Asia/Dubai", label: "Dubai (Gulf)" },
  { value: "Asia/Karachi", label: "Karachi (Pakistan)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dhaka", label: "Dhaka (Bangladesh)" },
  { value: "Asia/Bangkok", label: "Bangkok, Jakarta" },
  { value: "Asia/Singapore", label: "Singapore, Kuala Lumpur" },
  { value: "Asia/Manila", label: "Manila (Philippines)" },
  { value: "Asia/Shanghai", label: "Beijing, Shanghai (China)" },
  { value: "Asia/Tokyo", label: "Tokyo (Japan)" },
  { value: "Asia/Seoul", label: "Seoul (Korea)" },
  { value: "Australia/Sydney", label: "Sydney (Australia Eastern)" },
  { value: "Australia/Perth", label: "Perth (Australia Western)" },
  { value: "Pacific/Auckland", label: "Auckland (New Zealand)" },
  { value: "UTC", label: "UTC" },
];

/** The viewer's own IANA timezone, or "UTC" if it cannot be read. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Readable city from an IANA name, e.g. "America/New_York" -> "New York".
 * Pure string work, so it is safe to call during render on both sides.
 */
export function tzCityLabel(tz: string): string {
  if (!tz) return "";
  const parts = tz.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}
