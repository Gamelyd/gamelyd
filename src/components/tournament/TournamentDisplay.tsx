import Image from "next/image";
import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Tag, paymentFrame } from "@/components/ui/Tag";
import { FALLBACKS, resolveIcon } from "@/lib/icons";

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

function naira(amount: number): string {
  return "₦" + (amount || 0).toLocaleString();
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
  const showPrize =
    (tournament.Payment === "SPONSORED" || tournament.Payment === "PAID") &&
    tournament.Amount > 0;

  return (
    <Link
      href={`/tournament/${tournament.TournamentId}`}
      className={`group flex min-h-44 overflow-hidden rounded-2xl bg-primary-panel ${paymentFrame(tournament.Payment)}`}
    >
      <div className="relative w-32 shrink-0 bg-black sm:w-36">
        <Image
          src={image}
          alt={tournament.Name}
          fill
          sizes="144px"
          quality={90}
          className="object-cover"
        />
        <div className="absolute left-3 top-3">
          <Tag payment={tournament.Payment} className="rounded-md" />
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
            <p className="mt-1 truncate text-xs text-white/50">
              Hosted by {tournament.OrgName}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              {showPrize ? "Prize pool" : "Entry"}
            </p>
            <p className="font-display text-2xl leading-none text-primary">
              {showPrize
                ? naira(tournament.Amount)
                : tournament.IsPaid
                  ? naira(tournament.RegistrationAmount)
                  : "Free"}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-[#04201e] group-hover:bg-primary-dark">
            Enter
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
