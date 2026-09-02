import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import {
  TournamentDisplay,
  EmptyTournamentDisplay,
} from "@/components/tournament/TournamentDisplay";
import { HeroBracket } from "@/components/home/HeroBracket";
import { helpTarget } from "@/lib/help";

const FORMAT_JUMPS: { label: string; href: string }[] = [
  { label: "Knockout", href: "/tournament/all/ALL/MULTIPLAYER" },
  { label: "Groups", href: "/tournament/all/ALL/GROUPS" },
  { label: "League", href: "/tournament/all/ALL/LEAGUE" },
  { label: "Battle royale", href: "/tournament/all/ALL/BATTLEROYALE" },
];

export type HeroStats = {
  tournaments: number;
  open: number;
  titles: number;
};

/*
 * A count of 0 reads worse than no count at all, so a stat only appears once
 * it has something to say, and the strip hides entirely below two of them.
 */
function statList(stats: HeroStats): { value: number; label: string }[] {
  return [
    { value: stats.tournaments, label: "Tournaments hosted" },
    { value: stats.open, label: "Open to register" },
    { value: stats.titles, label: "Games and sports" },
  ].filter((row) => row.value > 0);
}

export function Hero({
  banner,
  stats,
}: {
  banner: Tournament[];
  stats: HeroStats;
}) {
  const shown = statList(stats);

  return (
    <section className="create-hud-head border-b border-primary/20 bg-primary-panel">
      <div className="mx-auto max-w-page px-page py-12 lg:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
              Tournament platform
            </p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              Host matches. Play for the crown.
            </h1>
            <p className="mt-4 max-w-xl text-base text-body sm:text-lg">
              Create a tournament, register teams, draw fixtures, and keep
              scores in one place: leagues, groups, knockouts, and battle
              royale lobbies.
            </p>
            <div
              className="mt-7 flex flex-wrap gap-3"
              {...helpTarget("home-hero")}
            >
              <Link href="/tournament/all/ALL/ALL">
                <Button>Browse tournaments</Button>
              </Link>
              <Link href="/tournament/new">
                <Button variant="outline">Create tournament</Button>
              </Link>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2">
              {FORMAT_JUMPS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-lg border border-white/12 px-3 py-1.5 text-sm text-white/70 transition-colors hover:border-primary/60 hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            {shown.length > 1 ? (
              <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/10 pt-6">
                {shown.map((row) => (
                  <div key={row.label}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                      {row.label}
                    </dt>
                    <dd className="mt-1 font-display text-3xl leading-none text-white">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <aside className="hidden lg:block">
            <HeroBracket />
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              Scores you enter update the tree and the table. No spreadsheet,
              no second chat for fixtures.
            </p>
          </aside>
        </div>

        <div className="mt-12">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl text-white">
              Featured events
            </h2>
            <Link
              href="/tournament/all/ALL/ALL"
              className="text-sm font-semibold text-primary hover:underline"
            >
              See all tournaments
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {banner[0] ? (
              <TournamentDisplay tournament={banner[0]} />
            ) : (
              <EmptyTournamentDisplay />
            )}
            {banner[1] ? (
              <TournamentDisplay tournament={banner[1]} />
            ) : (
              <EmptyTournamentDisplay />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
