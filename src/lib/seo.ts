import type { Metadata } from "next";
import type { Org } from "@/lib/schemas/org";
import type { User } from "@/lib/schemas/user";
import { publicAppUrl, absoluteImageUrl } from "@/lib/tournamentShare";

export const SITE_NAME = "Gamelyd";

const DEFAULT_DESCRIPTION =
  "Gamelyd is where you host and play game tournaments. Create a lobby, register teams, draw fixtures, set match times, and record scores for friends, clubs, and communities.";

const FORMAT_LABEL: Record<string, string> = {
  ALL: "tournaments",
  MULTIPLAYER: "knockout tournaments",
  GROUPS: "group tournaments",
  LEAGUE: "league tournaments",
  BATTLEROYALE: "battle royale tournaments",
};

export function pageMeta({
  title,
  description,
  path,
  image,
  imageAlt,
  noIndex = false,
  absoluteTitle = false,
}: {
  title: string;
  description?: string;
  path: string;
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
  absoluteTitle?: boolean;
}): Metadata {
  const desc = description?.trim() || DEFAULT_DESCRIPTION;
  const url = `${publicAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const displayTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  const images = image
    ? [
        {
          url: absoluteImageUrl(image),
          width: 1200,
          height: 630,
          alt: imageAlt ?? title,
          type: "image/png" as const,
        },
      ]
    : undefined;

  return {
    title: { absolute: displayTitle },
    description: desc,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: displayTitle,
      description: desc,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_GB",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description: desc,
      ...(image ? { images: [absoluteImageUrl(image)] } : {}),
    },
  };
}

export function browseTournamentsMeta(format: string): {
  title: string;
  description: string;
} {
  const formatKey = format.toUpperCase();
  const mode = FORMAT_LABEL[formatKey] ?? `${format.toLowerCase()} tournaments`;

  if (formatKey === "ALL") {
    return {
      title: "Tournaments",
      description:
        "Browse every tournament on Gamelyd across knockout, groups, league, and battle royale.",
    };
  }
  return {
    title: mode.charAt(0).toUpperCase() + mode.slice(1),
    description: `Browse ${mode} on Gamelyd.`,
  };
}

export function orgShareDescription(org: Org): string {
  const note = org.description?.replace(/\s+/g, " ").trim();
  if (note) return note.length > 180 ? `${note.slice(0, 177)}…` : note;
  return `${org.name} hosts game tournaments on Gamelyd.`;
}

export function profileShareDescription(user: User): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  const bits = [
    user.user_name ? `@${user.user_name}` : null,
    user.location || user.country || null,
  ].filter(Boolean);
  const who = bits.length ? `${name} (${bits.join(" · ")})` : name;
  return `${who} on Gamelyd. Host and join game tournaments.`;
}
