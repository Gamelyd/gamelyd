import { CatalogImage } from "@/components/ui/CatalogImage";
import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { PaymentTag, paymentFrame } from "@/components/ui/Tag";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { formatMoney } from "@/lib/currency";
import { RatingBadge } from "@/components/rating/RatingBadge";

function formatDate(date: string): string {
  if (!date) return "Date TBA";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date TBA";
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function modeLabel(mode: Tournament["TournamentMode"]): string {
  if (mode === "LEAGUE") return "League";
  if (mode === "BATTLEROYALE") return "Battle Royale";
  if (mode === "GROUPS") return "Groups";
  return "Knockout";
}

function teamLabel(team: Tournament["Team"]): string {
  if (team === "DUO") return "Duo";
  if (team === "SQUAD") return "Squad";
  return "Solo";
}

export function TournamentDisplay({ tournament }: { tournament: Tournament }) {
  const image = resolveIcon(tournament.icon, FALLBACKS.tournament);
  return (
    <Link
      href={`/tournament/${tournament.TournamentId}`}
      className={`group flex min-h-44 overflow-hidden rounded-2xl bg-primary-panel ${paymentFrame(tournament.Payment)}`}
    >
      <div className="relative w-32 shrink-0 overflow-hidden bg-black sm:w-36">
        <CatalogImage
          src={image}
          alt={tournament.Name}
          fill
          sizes="(max-width: 640px) 128px, 144px"
          quality={90}
          className="z-0 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {/* Tags sit at the top of this panel, so the gradient is darkest there
            and clears toward the foot, leaving the artwork readable. */}
        <div className="absolute inset-0 z-1 bg-linear-to-b from-black/75 via-black/30 to-black/10" />
        <div className="absolute left-3 top-3 z-2 flex flex-wrap gap-1.5">
          <PaymentTag payment={tournament.Payment} className="rounded-md" />
          {tournament.TournamentType === "PRIVATE" ? (
            <span className="inline-block rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Invite only
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {tournament.GameName}
          </p>
          <h3 className="mt-1 line-clamp-2 font-display text-xl leading-tight text-white sm:text-2xl">
            {tournament.Name}
          </h3>
          <p className="mt-2 truncate text-sm text-body">
            {[
              tournament.Platform || "Cross platform",
              modeLabel(tournament.TournamentMode),
              teamLabel(tournament.Team),
              formatDate(tournament.Date),
            ].join(" · ")}
          </p>
          {tournament.OrgName ? (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-white/50">
              Hosted by{" "}
              <VerifiedName
                name={tournament.OrgName}
                verified={tournament.OrgVerified}
              />
            </p>
          ) : null}
          {tournament.RatingCount > 0 ? (
            <span className="mt-1.5 block">
              <RatingBadge
                average={tournament.RatingAvg}
                count={tournament.RatingCount}
              />
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Entry
            </p>
            <p className="font-display text-2xl leading-none text-primary">
              Free
            </p>
            {tournament.Payment === "SPONSORED" &&
            (tournament.Prizes[0]?.Amount ?? 0) > 0 ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-yellow">
                Win {formatMoney(tournament.Prizes[0].Amount, tournament.Currency)}
              </p>
            ) : tournament.Payment === "SPONSORED" ? (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-yellow/70">
                Sponsored event
              </p>
            ) : null}
          </div>
          <span className="inline-flex shrink-0 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-[#04201e] group-hover:bg-primary-dark">
            {tournament.TournamentType === "PRIVATE" ? "View" : "Enter"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function EmptyTournamentDisplay() {
  return (
    <Link
      href="/contact-us"
      className="group arena-panel arena-hud-corners flex min-h-44 items-center overflow-hidden px-5 py-5"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Open slot
        </p>
        <h3 className="mt-1 font-display text-xl text-white sm:text-2xl">
          Feature your tournament
        </h3>
        <p className="mt-2 max-w-sm text-sm text-body">
          Two events sit in this banner. Contact us after your tournament is
          live to get listed.
        </p>
        <span className="mt-4 inline-flex items-center rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary group-hover:bg-primary group-hover:text-[#04201e]">
          Contact us
        </span>
      </div>
    </Link>
  );
}
