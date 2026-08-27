import type { Tournament } from "@/lib/schemas/tournament";
import { FALLBACKS, resolveIcon } from "@/lib/icons";

export function publicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.gamelyd.co";
}

export function tournamentCoverUrl(tournament: Tournament): string {
  const src = resolveIcon(tournament.icon, FALLBACKS.tournament);
  if (src.startsWith("/")) return `${publicAppUrl()}${src}`;
  return src;
}

export function tournamentShareDescription(tournament: Tournament): string {
  const note = tournament.Note?.replace(/\s+/g, " ").trim();
  if (note) return note.length > 180 ? `${note.slice(0, 177)}…` : note;

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
    bits.push(`Prize ₦${tournament.Amount.toLocaleString()}`);
  }
  return `${bits.join(" · ")}. Host and play on Gamelyd.`;
}

export function tournamentPageUrl(tournamentId: string): string {
  return `${publicAppUrl()}/tournament/${tournamentId}`;
}
