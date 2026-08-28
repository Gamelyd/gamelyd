"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { countryOptions } from "@/lib/countries";

export const MAX_VENUES = 8;

export type VenueDraft = { country: string; location: string };

export function PlaceEditor({
  country,
  city,
  onCountry,
  onCity,
  venues,
  onVenues,
  disabled,
}: {
  country: string;
  city: string;
  onCountry: (country: string) => void;
  onCity: (city: string) => void;
  venues: VenueDraft[];
  onVenues: (venues: VenueDraft[]) => void;
  disabled?: boolean;
}) {
  const options = [
    { label: "Select country", value: "" },
    ...countryOptions(),
  ];
  const venueCountryOptions = [
    { label: country ? "Same as location" : "Country (optional)", value: "" },
    ...countryOptions(),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1.5 text-sm text-label">Location</p>
        <p className="mb-3 text-xs text-body">
          Optional. Country and city are enough for people to find this event.
          You do not have to add a venue.
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <Select
            aria-label="Country"
            options={options}
            value={country}
            disabled={disabled}
            onChange={(e) => onCountry(e.target.value)}
          />
          <Input
            aria-label="City"
            value={city}
            disabled={disabled}
            onChange={(e) => onCity(e.target.value)}
            placeholder="City or area"
          />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm text-label">Venues</p>
        <p className="mb-3 text-xs text-body">
          Optional. Specific pitches, stadiums, or addresses. Leave empty if
          the location above is all you know yet.
        </p>
        <div className="flex flex-col gap-3">
          {venues.map((row, index) => (
            <div
              key={index}
              className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
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
              <Input
                aria-label={`Venue ${index + 1} address`}
                value={row.location}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...venues];
                  next[index] = { ...row, location: e.target.value };
                  onVenues(next);
                }}
                placeholder="Pitch, stadium, or full address"
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
          ))}
          {venues.length < MAX_VENUES ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="self-start"
              onClick={() =>
                onVenues([...venues, { country: "", location: "" }])
              }
            >
              Add venue
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
