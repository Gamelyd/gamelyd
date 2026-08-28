import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import {
  TournamentDisplay,
  EmptyTournamentDisplay,
} from "@/components/tournament/TournamentDisplay";
import { helpTarget } from "@/lib/help";

const FORMAT_JUMPS: { label: string; href: string; blurb: string }[] = [
  {
    label: "Knockout",
    href: "/tournament/all/ALL/MULTIPLAYER",
    blurb: "Win or go home",
  },
  {
    label: "Groups",
    href: "/tournament/all/ALL/GROUPS",
    blurb: "Pools, then a bracket",
  },
  {
    label: "League",
    href: "/tournament/all/ALL/LEAGUE",
    blurb: "Table decides it",
  },
  {
    label: "Battle royale",
    href: "/tournament/all/ALL/BATTLEROYALE",
    blurb: "Last squad standing",
  },
  {
    label: "Sponsored",
    href: "/tournament/all/SPONSORED/ALL",
    blurb: "Prize on the board",
  },
];

export function Hero({ banner }: { banner: Tournament[] }) {
  return (
    <section className="create-hud-head border-b border-primary/20 bg-primary-panel">
      <div className="mx-auto max-w-page px-page py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
              Live terminal
            </p>
            <h1 className="mt-2 font-display text-4xl leading-none text-white sm:text-5xl lg:text-6xl">
              Host matches. Play for the crown.
            </h1>
            <p className="mt-4 max-w-xl text-base text-body sm:text-lg">
              Create a tournament, register teams, draw fixtures, and keep
              scores in one place: leagues, groups, knockouts, and battle
              royale lobbies. Paid pots stay held until the event ends.
            </p>
            <div className="mt-6 flex flex-wrap gap-3" {...helpTarget("home-hero")}>
              <Link href="/tournament/all/ALL/ALL">
                <Button>Browse tournaments</Button>
              </Link>
              <Link href="/tournament/new">
                <Button variant="outline">Create tournament</Button>
              </Link>
            </div>
            <div className="mt-8 lg:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Jump to a format
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {FORMAT_JUMPS.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="inline-flex rounded-xl border border-primary/25 bg-black/20 px-3 py-2 text-sm text-white hover:border-primary hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="overflow-hidden rounded-2xl border border-primary/25 bg-black/25">
              <div className="border-b border-primary/20 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Loadout
                </p>
                <p className="font-display text-xl text-white">Quick join</p>
              </div>
              <ul>
                {FORMAT_JUMPS.map((item) => (
                  <li key={item.label} className="border-t border-white/5">
                    <Link
                      href={item.href}
                      className="flex items-baseline justify-between gap-3 px-4 py-3 hover:bg-primary/10"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                        {item.label}
                      </span>
                      <span className="truncate text-right text-sm text-white">
                        {item.blurb}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <div className="mt-10">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              Featured
            </p>
            <h2 className="mt-1 font-display text-2xl text-white">
              Pinned lobbies
            </h2>
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
