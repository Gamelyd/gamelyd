"use client";

import { useState } from "react";
import { venueMapsUrl } from "@/lib/venue";

export interface MapPin {
  label: string;
  country: string;
  lat: number;
  lng: number;
}

/** Roughly a few streets across: close enough to place a venue, wide enough for context. */
const SPAN = 0.012;

function embedUrl(pin: MapPin): string {
  const params = new URLSearchParams({
    bbox: [
      pin.lng - SPAN,
      pin.lat - SPAN / 2,
      pin.lng + SPAN,
      pin.lat + SPAN / 2,
    ].join(","),
    layer: "mapnik",
    marker: `${pin.lat},${pin.lng}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

/**
 * Shows where an event is played. Venues win over the event location, matching
 * how the rest of the app treats them: the city is the fallback for events that
 * have not named a ground yet.
 *
 * Uses OpenStreetMap's embed rather than a mapping library: no dependency, no
 * API key, and it renders the same coordinates the venue picker saved.
 */
export function VenueMap({ pins }: { pins: MapPin[] }) {
  const [index, setIndex] = useState(0);
  if (pins.length === 0) return null;

  const active = pins[Math.min(index, pins.length - 1)];
  const mapsUrl = venueMapsUrl({
    country: active.country,
    location: active.label,
    lat: active.lat,
    lng: active.lng,
  });

  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
          {pins.length > 1 ? "Venues" : "Location"}
        </h3>
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open in Maps
          </a>
        ) : null}
      </div>

      {pins.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {pins.map((pin, i) => (
            <button
              key={`${pin.label}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                i === index
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-surface-2 text-body hover:border-primary/40 hover:text-white"
              }`}
            >
              {pin.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-surface-2">
        <iframe
          key={`${active.lat},${active.lng}`}
          title={`Map of ${active.label}`}
          src={embedUrl(active)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-64 w-full border-0 sm:h-80"
        />
      </div>

      <p className="mt-2 text-sm text-white">{active.label}</p>
    </div>
  );
}
