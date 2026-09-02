import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import {
  TournamentCard,
  EmptyTournaments,
} from "@/components/tournament/TournamentCard";
import { Button } from "@/components/ui/Button";
import { SectionHead } from "@/components/home/HomeContent";
import { Reveal } from "@/components/ui/Reveal";
import { tournamentBrowsePhase } from "@/lib/tournamentStatus";

/*
 * Home should lead with events people can still join. Ended ones stay (a young
 * catalogue looks emptier without them) but sort to the back.
 */
const PHASE_ORDER = { REGISTRATION: 0, STARTED: 1, ENDED: 2 } as const;

function joinableFirst(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort(
    (a, b) =>
      PHASE_ORDER[tournamentBrowsePhase(a)] -
      PHASE_ORDER[tournamentBrowsePhase(b)],
  );
}

export function LatestTournaments({
  tournaments,
}: {
  tournaments: Tournament[];
}) {
  const ordered = joinableFirst(tournaments);

  return (
    <section className="border-t border-white/8">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <SectionHead
              title="Open now"
              description="Register or follow results from the event page."
            />
            <Link href="/tournament/all/ALL/ALL">
              <Button variant="outline">View all</Button>
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {ordered.length === 0 ? (
              <EmptyTournaments message="No tournaments yet. Create the first one." />
            ) : (
              ordered.map((t) => (
                <div
                  key={`${t._id}:${t.TournamentId}`}
                  className="create-game-card"
                >
                  <TournamentCard tournament={t} phaseBadge="notable" />
                </div>
              ))
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
