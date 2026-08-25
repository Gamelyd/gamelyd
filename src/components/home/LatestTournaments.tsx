import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import {
  TournamentCard,
  EmptyTournaments,
} from "@/components/tournament/TournamentCard";
import { Button } from "@/components/ui/Button";

export function LatestTournaments({
  tournaments,
}: {
  tournaments: Tournament[];
}) {
  return (
    <section className="bg-bg">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Events
            </p>
            <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
              Latest tournaments
            </h2>
            <p className="mt-2 text-body">
              Recently opened. Register or follow results from the event page.
            </p>
          </div>
          <Link href="/tournament/all/ALL/ALL">
            <Button variant="outline">View all</Button>
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {tournaments.length === 0 ? (
            <EmptyTournaments message="No tournaments yet. Create the first one." />
          ) : (
            tournaments.map((t) => (
              <TournamentCard
                key={`${t._id}:${t.TournamentId}`}
                tournament={t}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
