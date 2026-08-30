"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  BROWSE_STATUSES,
  browseTournamentsHref,
} from "@/lib/tournamentStatus";
import { countryOptions } from "@/lib/countries";
import {
  DEFAULT_NEAR_KM,
  NEAR_RADIUS_OPTIONS,
  type BrowseLocation,
} from "@/lib/venue";
import { useToast } from "@/components/ui/Toast";
import { helpTarget } from "@/lib/help";

const modes: { label: string; value: string }[] = [
  { label: "All", value: "ALL" },
  { label: "Knockout", value: "MULTIPLAYER" },
  { label: "Battle Royale", value: "BATTLEROYALE" },
  { label: "Groups", value: "GROUPS" },
  { label: "League", value: "LEAGUE" },
];

export function TournamentFilters({
  type,
  status,
  kind = "ALL",
  kinds = [],
  location,
}: {
  type: string;
  status: string;
  kind?: string;
  kinds?: { slug: string; label: string }[];
  location: BrowseLocation;
}) {
  const router = useRouter();
  const toast = useToast();
  const [place, setPlace] = useState(location.place);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setPlace(location.place);
  }, [location.place]);
  const countries = useMemo(
    () => [
      { label: "All countries", value: "" },
      ...countryOptions(),
    ],
    [],
  );
  const kindOptions = [
    { label: "All", value: "ALL" },
    ...kinds
      .filter(
        (item, i, all) => all.findIndex((k) => k.slug === item.slug) === i,
      )
      .map((item) => ({ label: item.label, value: item.slug })),
  ];

  const href = (next: Partial<BrowseLocation> & { status?: string; kind?: string; type?: string }) =>
    browseTournamentsHref({
      payment: "ALL",
      type: next.type ?? type,
      status: next.status ?? status,
      kind: next.kind ?? kind,
      country: next.country ?? location.country,
      place: next.place ?? location.place,
      lat: next.lat === undefined ? location.lat : next.lat,
      lng: next.lng === undefined ? location.lng : next.lng,
      radius: next.radius ?? location.radius,
    });

  const nearMe = () => {
    if (!navigator.geolocation) {
      toast.error("This browser cannot share your location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        router.push(
          href({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radius: location.radius || DEFAULT_NEAR_KM,
          }),
        );
      },
      () => {
        setLocating(false);
        toast.error("Allow location to see sports events around you");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const nearOn = location.lat != null && location.lng != null;
  const filtered =
    type.toUpperCase() !== "ALL" ||
    status.toUpperCase() !== "ALL" ||
    kind.toUpperCase() !== "ALL" ||
    Boolean(location.country) ||
    Boolean(location.place) ||
    Boolean(place.trim()) ||
    nearOn;

  const clearFilters = () => {
    setPlace("");
    router.push(
      browseTournamentsHref({
        payment: "ALL",
        type: "ALL",
        status: "ALL",
        kind: "ALL",
        country: "",
        place: "",
        lat: null,
        lng: null,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4" {...helpTarget("browse-filters")}>
        <div className="w-48">
          <Select
            label="Status"
            options={[...BROWSE_STATUSES]}
            value={status}
            onChange={(e) => router.push(href({ status: e.target.value }))}
          />
        </div>
        <div className="w-48">
          <Select
            label="Kind"
            options={kindOptions}
            value={kind}
            onChange={(e) => router.push(href({ kind: e.target.value }))}
          />
        </div>
        <div className="w-48">
          <Select
            label="Mode"
            options={modes}
            value={type}
            onChange={(e) => router.push(href({ type: e.target.value }))}
          />
        </div>
        {filtered ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-end gap-4"
        {...helpTarget("browse-location")}
      >
        <div className="w-56">
          <Select
            label="Country"
            options={countries}
            value={location.country}
            onChange={(e) => router.push(href({ country: e.target.value }))}
          />
        </div>
        <form
          className="flex min-w-60 flex-1 flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(href({ place: place.trim() }));
          }}
        >
          <div className="min-w-48 flex-1">
            <Input
              label="City or venue"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Lagos, Abuja…"
            />
          </div>
          <Button type="submit" variant="outline" className="shrink-0">
            Search
          </Button>
        </form>
        <div className="flex flex-wrap items-end gap-3">
          {nearOn ? (
            <div className="w-32">
              <Select
                label="Within"
                options={[...NEAR_RADIUS_OPTIONS]}
                value={String(location.radius)}
                onChange={(e) =>
                  router.push(href({ radius: Number(e.target.value) }))
                }
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant={nearOn ? "default" : "outline"}
            loading={locating}
            onClick={nearOn ? () => router.push(href({ lat: null, lng: null })) : nearMe}
          >
            {nearOn ? "Clear near me" : "Near me"}
          </Button>
        </div>
      </div>
    </div>
  );
}
