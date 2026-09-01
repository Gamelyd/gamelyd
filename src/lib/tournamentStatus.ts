export const BROWSE_STATUSES = [
  { label: "All", value: "ALL" },
  { label: "Registration open", value: "REGISTRATION" },
  { label: "Started", value: "STARTED" },
  { label: "Ended", value: "ENDED" },
] as const;

export type BrowseStatus = (typeof BROWSE_STATUSES)[number]["value"];

export const BROWSE_STATUS_LABEL: Record<
  Exclude<BrowseStatus, "ALL">,
  string
> = {
  REGISTRATION: "Registration open",
  STARTED: "Started",
  ENDED: "Ended",
};

export function parseBrowseStatus(
  raw: string | undefined | null,
): BrowseStatus {
  const key = String(raw ?? "ALL").toUpperCase();
  if (key === "REGISTRATION" || key === "ACTIVE") return "REGISTRATION";
  if (key === "STARTED") return "STARTED";
  if (key === "ENDED" || key === "CLOSED") return "ENDED";
  return "ALL";
}

export function browseTournamentsHref(args: {
  payment: string;
  type: string;
  status?: string;
  page?: number;
  kind?: string;
  country?: string;
  place?: string;
  lat?: number | null;
  lng?: number | null;
  radius?: number;
  org?: string;
}): string {
  const pay = args.payment || "ALL";
  const fmt = args.type || "ALL";
  const params = new URLSearchParams();
  const parsed = parseBrowseStatus(args.status);
  if (parsed !== "ALL") params.set("status", parsed);
  const kindSlug = (args.kind ?? "ALL").trim().toLowerCase();
  if (kindSlug && kindSlug !== "all") params.set("kind", kindSlug);
  const country = (args.country ?? "").trim().toUpperCase();
  if (country) params.set("country", country);
  const place = (args.place ?? "").trim();
  if (place) params.set("place", place);
  const org = (args.org ?? "").trim();
  if (org) params.set("org", org);
  if (
    args.lat != null &&
    args.lng != null &&
    Number.isFinite(args.lat) &&
    Number.isFinite(args.lng)
  ) {
    params.set("lat", String(args.lat));
    params.set("lng", String(args.lng));
    if (args.radius && args.radius !== 50) {
      params.set("radius", String(args.radius));
    }
  }
  if (args.page && args.page > 1) params.set("page", String(args.page));
  const query = params.toString();
  return query
    ? `/tournament/all/${pay}/${fmt}?${query}`
    : `/tournament/all/${pay}/${fmt}`;
}

/** Non-empty champion name, covering both Next.js and older Go documents. */
export function endedWinnerClause(): Record<string, unknown> {
  return {
    $or: [
      { "Winner.TeamName": { $gt: "" } },
      { "Winner.teamname": { $gt: "" } },
      { "winner.TeamName": { $gt: "" } },
      { "winner.teamname": { $gt: "" } },
    ],
  };
}

export function browseStatusClause(
  status: string,
): Record<string, unknown> | null {
  const key = parseBrowseStatus(status);
  const notStarted = {
    $and: [{ Start: { $ne: true } }, { start: { $ne: true } }],
  };
  const started = { $or: [{ Start: true }, { start: true }] };
  const ended = endedWinnerClause();

  if (key === "REGISTRATION") {
    return { $and: [notStarted, { $nor: [ended] }] };
  }
  if (key === "STARTED") {
    return { $and: [started, { $nor: [ended] }] };
  }
  if (key === "ENDED") {
    return ended;
  }
  return null;
}

export function tournamentBrowsePhase(tournament: {
  Start: boolean;
  Winner?: { TeamName?: string } | null;
}): Exclude<BrowseStatus, "ALL"> {
  if (tournament.Winner?.TeamName?.trim()) return "ENDED";
  if (tournament.Start) return "STARTED";
  return "REGISTRATION";
}
