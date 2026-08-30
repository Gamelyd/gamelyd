import { getCountries } from "libphonenumber-js";
import { COUNTRY_NAMES } from "./countryNames";

export function countryName(code: string): string {
  const iso = code.trim().toUpperCase();
  if (!iso) return "";
  return COUNTRY_NAMES[iso] ?? iso;
}

export function countryOptions(): { value: string; label: string }[] {
  return getCountries()
    .map((code) => ({
      value: code,
      label: COUNTRY_NAMES[code] ?? code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Accept an ISO code or an English country name. */
export function parseCountryCode(raw: string | undefined | null): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  const codes = new Set(getCountries().map((code) => String(code)));
  if (upper.length === 2 && codes.has(upper)) return upper;
  const match = getCountries().find(
    (code) => (COUNTRY_NAMES[code] ?? "").toLowerCase() === value.toLowerCase(),
  );
  return match ? String(match) : "";
}
