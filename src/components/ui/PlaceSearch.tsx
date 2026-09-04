"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PlaceResult } from "@/lib/schemas/place";
import { searchPlacesAction } from "@/server/actions/placeActions";

/**
 * Type-ahead place picker. The host searches, sees real candidates, and picks
 * one. The chosen result carries its own coordinates, so what gets saved is
 * exactly the place they confirmed.
 */
export function PlaceSearch({
  label,
  value,
  country = "",
  placeholder = "Search for a stadium, pitch, or address",
  disabled,
  hint,
  onSelect,
  onClear,
}: {
  label?: string;
  /** The currently saved label, shown when nothing is being searched. */
  value: string;
  country?: string;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  onSelect: (place: PlaceResult) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Debounced so typing does not hammer the shared geocoder.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchPlacesAction({ query: q, country }).then((result) => {
        if (!active) return;
        setResults(result.ok ? result.data : []);
        setSearched(true);
        setLoading(false);
      });
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, country]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (place: PlaceResult) => {
    onSelect(place);
    setQuery("");
    setResults([]);
    setSearched(false);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      {label ? (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      ) : null}

      {value ? (
        <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-primary/35 bg-primary/10 px-3 py-2.5">
          <span className="min-w-0 text-sm text-white">{value}</span>
          {onClear && !disabled ? (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 cursor-pointer text-xs text-body transition-colors hover:text-white"
            >
              Change
            </button>
          ) : null}
        </div>
      ) : null}

      {!value || !onClear ? (
        <>
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="w-full rounded-lg border border-primary/25 bg-input px-4 py-3 text-base text-white outline-none transition-colors focus:border-primary disabled:opacity-60 sm:text-sm"
          />
          {hint ? (
            <p className="mt-1.5 text-xs text-body">{hint}</p>
          ) : null}

          {open && query.trim().length >= 3 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-surface-2 bg-surface py-1 shadow-2xl"
            >
              {loading ? (
                <li className="px-3 py-2.5 text-sm text-body">Searching…</li>
              ) : results.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-body">
                  {searched
                    ? "No places found. Try a nearby landmark or the city name."
                    : "Keep typing…"}
                </li>
              ) : (
                results.map((place, index) => (
                  <li key={place.id} role="option" aria-selected={index === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(place)}
                      className={`block w-full cursor-pointer px-3 py-2.5 text-left transition-colors ${
                        index === active ? "bg-primary-panel" : ""
                      }`}
                    >
                      <span className="block truncate text-sm text-white">
                        {place.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-body">
                        {place.label}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
