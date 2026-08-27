import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import {
  TournamentCard,
  EmptyTournaments,
} from "@/components/tournament/TournamentCard";
import { Button } from "@/components/ui/Button";
import { SectionHead } from "@/components/home/HomeContent";
import { Reveal } from "@/components/ui/Reveal";

export function LatestTournaments({
  tournaments,
}: {
  tournaments: Tournament[];
}) {
  return (
    <section className="border-t border-primary/20">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <Reveal>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <SectionHead
              kicker="Events"
              title="Latest tournaments"
              description="Recently opened. Register or follow results from the event page."
            />
            <Link href="/tournament/all/ALL/ALL">
              <Button variant="outline">View all</Button>
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {tournaments.length === 0 ? (
              <EmptyTournaments message="No tournaments yet. Create the first one." />
            ) : (
              tournaments.map((t) => (
                <div
                  key={`${t._id}:${t.TournamentId}`}
                  className="create-game-card"
                >
                  <TournamentCard tournament={t} />
                </div>
              ))
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
