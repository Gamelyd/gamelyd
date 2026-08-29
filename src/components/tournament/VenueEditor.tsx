"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PlaceSearch } from "@/components/ui/PlaceSearch";
import { countryOptions } from "@/lib/countries";
import type { PlaceResult } from "@/lib/schemas/place";

export const MAX_VENUES = 8;

/**
 * A venue row. `lat`/`lng` are only non-zero once the host picked the place
 * from search, which is what tells the server not to re-guess the location.
 */
export type VenueDraft = {
  country: string;
  location: string;
  lat: number;
  lng: number;
};

export function emptyVenue(): VenueDraft {
  return { country: "", location: "", lat: 0, lng: 0 };
}

export function PlaceEditor({
  country,
  city,
  cityLat = 0,
  cityLng = 0,
  onCountry,
  onCity,
  onCityPlace,
  venues,
  onVenues,
  disabled,
}: {
  country: string;
  city: string;
  cityLat?: number;
  cityLng?: number;
  onCountry: (country: string) => void;
  onCity: (city: string) => void;
  onCityPlace: (place: { city: string; country: string; lat: number; lng: number }) => void;
  venues: VenueDraft[];
  onVenues: (venues: VenueDraft[]) => void;
  disabled?: boolean;
}) {
  const options = [{ label: "Any country", value: "" }, ...countryOptions()];
  const venueCountryOptions = [
    { label: country ? "Same as location" : "Country (optional)", value: "" },
    ...countryOptions(),
  ];
  const cityPicked = city.length > 0 && (cityLat !== 0 || cityLng !== 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1.5 text-sm text-label">Where is this event?</p>
        <p className="mb-3 text-xs text-body">
          Search for the town or city and pick it from the list. Choosing a
          result pins the event on the map so players can find it by location.
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <Select
            aria-label="Country"
            options={options}
            value={country}
            disabled={disabled}
            onChange={(e) => onCountry(e.target.value)}
          />
          <PlaceSearch
            value={cityPicked ? city : ""}
            country={country}
            disabled={disabled}
            placeholder="Search a city or town"
            hint={
              city && !cityPicked
                ? `Saved as "${city}". Pick it from search to pin it on the map.`
                : undefined
            }
            onSelect={(place: PlaceResult) =>
              onCityPlace({
                city: place.city || place.name,
                country: place.country || country,
                lat: place.lat,
                lng: place.lng,
              })
            }
            onClear={() => {
              onCity("");
              onCityPlace({ city: "", country, lat: 0, lng: 0 });
            }}
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm text-label">Venues</p>
        <p className="mb-3 text-xs text-body">
          Optional. Search for the stadium, pitch, or address. Leave empty if
          the location above is all you know yet.
        </p>
        <div className="flex flex-col gap-3">
          {venues.map((row, index) => {
            const picked = row.location.length > 0 && (row.lat !== 0 || row.lng !== 0);
            return (
              <div
                key={index}
                className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr_auto]"
              >
                <Select
                  aria-label={`Venue ${index + 1} country`}
                  options={venueCountryOptions}
                  value={row.country}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...venues];
                    next[index] = { ...row, country: e.target.value };
                    onVenues(next);
                  }}
                />
                <PlaceSearch
                  value={picked ? row.location : ""}
                  country={row.country || country}
                  disabled={disabled}
                  placeholder="Search a stadium, pitch, or address"
                  hint={
                    row.location && !picked
                      ? `Saved as "${row.location}". Pick it from search to pin it.`
                      : undefined
                  }
                  onSelect={(place) => {
                    const next = [...venues];
                    next[index] = {
                      country: row.country || place.country,
                      location: place.label,
                      lat: place.lat,
                      lng: place.lng,
                    };
                    onVenues(next);
                  }}
                  onClear={() => {
                    const next = [...venues];
                    next[index] = { ...row, location: "", lat: 0, lng: 0 };
                    onVenues(next);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  className="px-3"
                  onClick={() => onVenues(venues.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          {venues.length < MAX_VENUES ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="self-start"
              onClick={() => onVenues([...venues, emptyVenue()])}
            >
              Add venue
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
