import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import {
  TournamentDisplay,
  EmptyTournamentDisplay,
} from "@/components/tournament/TournamentDisplay";

export function Hero({ banner }: { banner: Tournament[] }) {
  return (
    <section className="border-b border-surface-2 bg-bg">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Competitive gaming
          </p>
          <h1 className="mt-2 font-display text-4xl leading-none text-white sm:text-5xl lg:text-6xl">
            Host matches. Play for the crown.
          </h1>
          <p className="mt-4 max-w-xl text-base text-body sm:text-lg">
            Create a tournament, register teams, draw fixtures, and keep scores
            in one place — leagues, groups, knockouts, and battle royale lobbies.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tournament/all/ALL/ALL">
              <Button>Browse tournaments</Button>
            </Link>
            <Link href="/tournament/new">
              <Button variant="outline">Create tournament</Button>
            </Link>
          </div>
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
              Jump to a format
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[
                ["Knockout", "/tournament/all/ALL/MULTIPLAYER"],
                ["Groups", "/tournament/all/ALL/GROUPS"],
                ["League", "/tournament/all/ALL/LEAGUE"],
                ["Battle royale", "/tournament/all/ALL/BATTLEROYALE"],
                ["Sponsored", "/tournament/all/SPONSORED/ALL"],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="inline-flex rounded-lg border border-white/20 bg-surface px-3 py-2 text-sm text-white hover:border-primary hover:text-primary"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl text-white">Featured</h2>
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
