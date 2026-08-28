import { getCountries } from "libphonenumber-js";

let regionNamesCache: Intl.DisplayNames | null | undefined;

function regionNames(): Intl.DisplayNames | null {
  if (regionNamesCache !== undefined) return regionNamesCache;
  try {
    regionNamesCache =
      typeof Intl !== "undefined" && "DisplayNames" in Intl
        ? new Intl.DisplayNames(["en"], { type: "region" })
        : null;
  } catch {
    regionNamesCache = null;
  }
  return regionNamesCache;
}

export function countryName(code: string): string {
  const iso = code.trim().toUpperCase();
  if (!iso) return "";
  return regionNames()?.of(iso) ?? iso;
}

export function countryOptions(): { value: string; label: string }[] {
  const names = regionNames();
  return getCountries()
    .map((code) => ({
      value: code,
      label: names?.of(code) ?? code,
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
  const names = regionNames();
  if (!names) return "";
  const match = getCountries().find(
    (code) => names.of(code)?.toLowerCase() === value.toLowerCase(),
  );
  return match ? String(match) : "";
}
