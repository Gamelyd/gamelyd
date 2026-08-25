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
    <section className="mx-auto max-w-7xl px-5 py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl text-white md:text-5xl">
            Latest tournaments
          </h2>
          <p className="mt-2 text-body">
            Recently created events. Open one to register or watch.
          </p>
        </div>
        <Link href="/tournament/all/ALL/ALL">
          <Button variant="outline">View more</Button>
        </Link>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {tournaments.length === 0 ? (
          <EmptyTournaments message="No tournaments yet. Be the first to create one." />
        ) : (
          tournaments.map((t) => (
            <TournamentCard
              key={`${t._id}:${t.TournamentId}`}
              tournament={t}
            />
          ))
        )}
      </div>
    </section>
  );
}
