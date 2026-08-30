import type { Tournament } from "@/lib/schemas/tournament";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { formatMoney } from "@/lib/currency";

export function publicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.gamelyd.co";
}

export function absoluteImageUrl(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/")) return `${publicAppUrl()}${src}`;
  return src;
}

export function tournamentCoverUrl(tournament: Tournament): string {
  const src = resolveIcon(tournament.icon, FALLBACKS.tournament);
  return absoluteImageUrl(src);
}

/** Reduce Markdown to plain text for social meta descriptions. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function tournamentShareDescription(tournament: Tournament): string {
  // The plain Description is written for link previews; use it first, then fall
  // back to the Markdown brief (stripped to plain text).
  const summary = (
    tournament.Description || stripMarkdown(tournament.Note ?? "")
  )
    .replace(/\s+/g, " ")
    .trim();
  if (summary) {
    return summary.length > 180 ? `${summary.slice(0, 177)}…` : summary;
  }

  const bits = [
    tournament.GameName,
    tournament.Platform || "Cross platform",
    tournament.TournamentMode === "BATTLEROYALE"
      ? "Battle Royale"
      : tournament.TournamentMode === "GROUPS"
        ? "Groups"
        : tournament.TournamentMode === "LEAGUE"
          ? "League"
          : "Knockout",
    tournament.Date || undefined,
  ].filter(Boolean);
  if (tournament.Amount > 0) {
    bits.push(`Prize ${formatMoney(tournament.Amount, tournament.Currency)}`);
  }
  return `${bits.join(" · ")}. Host and play on Gamelyd.`;
}

export function tournamentPageUrl(tournamentId: string): string {
  return `${publicAppUrl()}/tournament/${tournamentId}`;
}
