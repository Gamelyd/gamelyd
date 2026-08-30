"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { countryName } from "@/lib/countries";

interface Country {
  code: CountryCode;
  name: string;
  calling: string;
  flag: string;
}

/** Turn an ISO country code (e.g. "NG") into its flag emoji. */
function flagFor(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function buildCountries(): Country[] {
  return getCountries()
    .map((code) => ({
      code,
      calling: getCountryCallingCode(code),
      name: countryName(code),
      flag: flagFor(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (e164: string) => void;
  error?: string;
  required?: boolean;
  defaultCountry?: CountryCode;
  placeholder?: string;
}

export function PhoneInput({
  label,
  value,
  onChange,
  error,
  required,
  defaultCountry = "NG",
  placeholder = "801 234 5678",
}: PhoneInputProps) {
  const countries = useMemo(buildCountries, []);
  const phoneId = useId();

  const initial = useMemo(() => {
    if (value) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed?.country) {
        return {
          country: parsed.country,
          national: parsed.formatNational(),
        };
      }
    }
    return { country: defaultCountry, national: "" };
  }, [value, defaultCountry]);

  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const emit = (nextCountry: CountryCode, rawNational: string) => {
    const formatter = new AsYouType(nextCountry);
    const formatted = formatter.input(rawNational);
    setNational(formatted);
    const num = formatter.getNumber();
    onChange(num ? num.number : "");
  };

  const selected = countries.find((c) => c.code === country);
  const q = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const filtered = q
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (digits.length > 0 && c.calling.includes(digits)),
      )
    : countries;

  return (
    <div className="block w-full">
      {label && (
        <label htmlFor={phoneId} className="mb-1.5 block text-sm text-label">
          {label}
        </label>
      )}
      <div
        ref={boxRef}
        className={`relative flex items-stretch rounded-lg border bg-input transition-colors focus-within:border-primary ${error ? "border-lose" : "border-primary/25"}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1.5 rounded-l-lg border-r border-primary/20 px-3 text-sm text-white outline-none hover:bg-white/5"
        >
          <span className="text-base leading-none">{selected?.flag}</span>
          <span className="text-body">+{selected?.calling}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-body"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <input
          id={phoneId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          value={national}
          placeholder={placeholder}
          onChange={(e) => emit(country, e.target.value)}
          className="w-full rounded-r-lg bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-body/50"
        />

        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-72 overflow-hidden rounded-lg border border-surface-2 bg-surface shadow-xl">
            <div className="p-2">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search country"
                className="w-full rounded-md bg-input px-3 py-2 text-sm text-white outline-none placeholder:text-body/50"
              />
            </div>
            <ul className="max-h-60 overflow-y-auto pb-1" role="listbox">
              {filtered.map((c) => (
                <li key={c.code} role="option" aria-selected={c.code === country}>
                  <button
                    type="button"
                    onClick={() => {
                      setCountry(c.code);
                      setOpen(false);
                      setQuery("");
                      emit(c.code, national);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${c.code === country ? "text-primary" : "text-white"}`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-body">+{c.calling}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-center text-sm text-body">
                  No matches
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {error && <span className="mt-1 block text-xs text-lose">{error}</span>}
    </div>
  );
}
