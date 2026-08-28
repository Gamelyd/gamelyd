import { rosterSize, type TeamSize } from "@/lib/schemas/common";
import type { CatalogKind } from "@/lib/schemas/catalogKind";
import type { CatalogFormat, ScoreLabel } from "@/lib/schemas/game";

export const GAMES_KIND = "games";
export const SPORTS_KIND = "sports";

export const DEFAULT_CATALOG_KINDS: Omit<
  CatalogKind,
  "_id" | "kind_id" | "created_at" | "updated_at"
>[] = [
  {
    slug: GAMES_KIND,
    label: "Games",
    usesPlatforms: true,
    usesBattleRoyale: true,
    usesInGameName: true,
    usesVenue: false,
    sort: 0,
  },
  {
    slug: SPORTS_KIND,
    label: "Sports",
    usesPlatforms: false,
    usesBattleRoyale: false,
    usesInGameName: false,
    usesVenue: true,
    sort: 1,
  },
];

export const FOOTBALL_PRESET = {
  name: "Football",
  kind: SPORTS_KIND,
  allowDraw: true,
  scoreLabel: "Goals" as ScoreLabel,
  formats: [
    { id: "5-a-side", label: "5-a-side", roster: 5 },
    { id: "7-a-side", label: "7-a-side", roster: 7 },
    { id: "11-a-side", label: "11-a-side", roster: 11 },
  ] satisfies CatalogFormat[],
};

export const BASKETBALL_PRESET = {
  name: "Basketball",
  kind: SPORTS_KIND,
  allowDraw: false,
  scoreLabel: "Points" as ScoreLabel,
  formats: [
    { id: "3v3", label: "3v3", roster: 3 },
    { id: "5v5", label: "5v5", roster: 5 },
  ] satisfies CatalogFormat[],
};

export function teamSizeFromRoster(count: number): TeamSize {
  if (count <= 1) return "SINGLE";
  if (count === 2) return "DUO";
  return "SQUAD";
}

export function tournamentRosterSize(t: {
  Team?: string;
  RosterCount?: number;
}): number {
  return rosterSize(t.Team ?? "SINGLE", t.RosterCount);
}

function labelFromSlug(slug: string | undefined): string {
  if (!slug || slug === GAMES_KIND) return "Games";
  if (slug === SPORTS_KIND) return "Sports";
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function kindUses(
  kinds: CatalogKind[],
  slug: string | undefined,
): Pick<
  CatalogKind,
  "usesPlatforms" | "usesBattleRoyale" | "usesInGameName" | "usesVenue" | "label"
> {
  const found = kinds.find((k) => k.slug === (slug || GAMES_KIND));
  if (found) {
    return {
      usesPlatforms: found.usesPlatforms,
      usesBattleRoyale: found.usesBattleRoyale,
      usesInGameName: found.usesInGameName,
      usesVenue: found.usesVenue,
      label: found.label,
    };
  }
  const seeded = DEFAULT_CATALOG_KINDS.find((k) => k.slug === slug);
  if (seeded) {
    return {
      usesPlatforms: seeded.usesPlatforms,
      usesBattleRoyale: seeded.usesBattleRoyale,
      usesInGameName: seeded.usesInGameName,
      usesVenue: seeded.usesVenue,
      label: seeded.label,
    };
  }
  return {
    usesPlatforms: slug === GAMES_KIND || !slug,
    usesBattleRoyale: slug === GAMES_KIND || !slug,
    usesInGameName: slug === GAMES_KIND || !slug,
    usesVenue: slug === SPORTS_KIND,
    label: labelFromSlug(slug),
  };
}

export function parseCatalogKind(raw: string | undefined | null): string {
  const slug = String(raw ?? "ALL").trim().toLowerCase();
  if (!slug || slug === "all") return "ALL";
  return slug;
}

/** Mongo clause so older tournaments without CatalogKind count as games. */
export function catalogKindClause(kind: string): Record<string, unknown> | null {
  const slug = parseCatalogKind(kind);
  if (slug === "ALL") return null;
  if (slug === GAMES_KIND) {
    return {
      $or: [
        { CatalogKind: GAMES_KIND },
        { catalogkind: GAMES_KIND },
        { CatalogKind: { $exists: false } },
        { CatalogKind: "" },
        { catalogkind: "" },
      ],
    };
  }
  return { $or: [{ CatalogKind: slug }, { catalogkind: slug }] };
}

export function catalogSubtitle(t: {
  GameName: string;
  FormatName?: string;
}): string {
  const format = (t.FormatName ?? "").trim();
  return format ? `${t.GameName} · ${format}` : t.GameName;
}

export function kindPublicLabel(slug: string | undefined): string {
  return kindUses([], slug).label;
}

export function scoreColumnLabels(scoreLabel: string | undefined): {
  for: string;
  against: string;
  diff: string;
  difference: string;
} {
  if (scoreLabel === "Points") {
    return {
      for: "PF",
      against: "PA",
      diff: "PD",
      difference: "Point difference",
    };
  }
  return {
    for: "GF",
    against: "GA",
    diff: "GD",
    difference: "Goal difference",
  };
}
