import Image from "next/image";
import { CatalogImage } from "@/components/ui/CatalogImage";
import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Tag, paymentFrame } from "@/components/ui/Tag";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import {
  BROWSE_STATUS_LABEL,
  tournamentBrowsePhase,
} from "@/lib/tournamentStatus";
import { VerifiedName } from "@/components/ui/VerifiedName";
import {
  catalogSubtitle,
  GAMES_KIND,
  kindPublicLabel,
} from "@/lib/catalog";
import {
  formatDistanceKm,
  nearestVenueKm,
  venueLabel,
} from "@/lib/venue";

export function TournamentCard({
  tournament,
  from,
}: {
  tournament: Tournament;
  from?: { lat: number; lng: number };
}) {
  const image = resolveIcon(tournament.icon, FALLBACKS.tournament);
  const phase = tournamentBrowsePhase(tournament);
  const kindSlug = tournament.CatalogKind || GAMES_KIND;
  const kindLabel = kindPublicLabel(kindSlug);
  const venue = venueLabel(tournament);
  const km = from ? nearestVenueKm(tournament, from) : null;
  const distance = km != null ? formatDistanceKm(km) : "";

  return (
    <Link
      href={`/tournament/${tournament.TournamentId}`}
      className={`group relative flex h-full min-h-55 flex-col overflow-hidden rounded-xl bg-surface-4 ${paymentFrame(tournament.Payment)}`}
    >
      <CatalogImage
        src={image}
        alt={tournament.Name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
        quality={90}
        className="z-0 object-cover"
      />
      <div className="absolute inset-0 z-1 bg-linear-to-t from-black via-black/45 to-black/10" />

      <div
        className={`absolute left-3 top-3 z-2 flex flex-wrap gap-1.5 ${
          tournament.OrgId && tournament.OrgName
            ? "max-w-[calc(100%-8.5rem)]"
            : "right-3"
        }`}
      >
        <Tag payment={tournament.Payment} className="rounded-md" />
        {tournament.TournamentType === "PRIVATE" ? (
          <span className="inline-block rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            Invite only
          </span>
        ) : null}
        <span className="inline-block rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          {BROWSE_STATUS_LABEL[phase]}
        </span>
        {kindSlug !== GAMES_KIND ? (
          <span className="inline-block rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            {kindLabel}
          </span>
        ) : null}
      </div>

      {tournament.OrgId && tournament.OrgName && (
        <div className="absolute right-3 top-3 z-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-primary">
          {tournament.OrgIcon && (
            <Image
              src={tournament.OrgIcon}
              alt={tournament.OrgName}
              width={14}
              height={14}
              className="rounded-full object-cover"
            />
          )}
          <VerifiedName
            name={tournament.OrgName}
            verified={tournament.OrgVerified}
            className="max-w-[90px] text-[11px]"
          />
        </div>
      )}

      <div className="relative z-2 mt-auto w-full px-3 py-3">
        <span className="line-clamp-1 font-display text-[20px] leading-tight text-white">
          {tournament.Name}
        </span>
        <span className="line-clamp-1 font-body text-xs text-body">
          {catalogSubtitle(tournament)}
        </span>
        {venue ? (
          <span className="line-clamp-1 font-body text-xs text-white/70">
            {distance ? `${distance} · ${venue}` : venue}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function EmptyTournaments({
  message = "No tournaments yet",
}: {
  message?: string;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-primary/25 bg-primary-panel py-16 text-center text-body">
      {message}
    </div>
  );
}
