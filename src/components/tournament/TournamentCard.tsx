import Image from "next/image";
import { CatalogImage } from "@/components/ui/CatalogImage";
import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { PaymentTag, paymentFrame } from "@/components/ui/Tag";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import {
  BROWSE_STATUS_LABEL,
  tournamentBrowsePhase,
} from "@/lib/tournamentStatus";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { catalogSubtitle } from "@/lib/catalog";
import {
  formatDistanceKm,
  nearestVenueKm,
  venueLabel,
} from "@/lib/venue";
import { formatMoney } from "@/lib/currency";
import { RatingBadge } from "@/components/rating/RatingBadge";

export function TournamentCard({
  tournament,
  from,
  /*
   * "notable" drops the phase badge from events that are open to register,
   * for lists that already say so in their heading - ten identical
   * REGISTRATION OPEN chips under "Open now" are noise, not information.
   */
  phaseBadge = "all",
}: {
  tournament: Tournament;
  from?: { lat: number; lng: number };
  phaseBadge?: "all" | "notable";
}) {
  const image = resolveIcon(tournament.icon, FALLBACKS.tournament);
  const phase = tournamentBrowsePhase(tournament);
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

      {/*
       * Four stacked badges covered the top third of the artwork and ran into
       * the org chip. Phase is what people scan for, payment is what makes an
       * event special; access and catalogue kind are on the event page.
       */}
      <div
        className={`absolute left-3 top-3 z-2 flex flex-wrap gap-1.5 ${
          tournament.OrgId && tournament.OrgName
            ? "max-w-[calc(100%-8.5rem)]"
            : "right-3"
        }`}
      >
        {phaseBadge === "all" || phase !== "REGISTRATION" ? (
          <span className="inline-block rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            {BROWSE_STATUS_LABEL[phase]}
          </span>
        ) : null}
        <PaymentTag payment={tournament.Payment} className="rounded-md" />
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
        {tournament.Payment === "SPONSORED" &&
        (tournament.Prizes[0]?.Amount ?? 0) > 0 ? (
          <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-yellow/20 px-2 py-0.5 text-xs font-semibold text-yellow">
            Win {formatMoney(tournament.Prizes[0].Amount, tournament.Currency)}
          </span>
        ) : null}
        <span className="line-clamp-1 font-display text-[20px] leading-tight text-white">
          {tournament.Name}
        </span>
        <span className="line-clamp-1 font-body text-xs text-body">
          {catalogSubtitle(tournament)}
        </span>
        {tournament.RatingCount > 0 ? (
          <span className="mt-1 block">
            <RatingBadge
              average={tournament.RatingAvg}
              count={tournament.RatingCount}
            />
          </span>
        ) : null}
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
