import type { Tournament } from "@/lib/schemas/tournament";
import {
  TournamentDisplay,
  EmptyTournamentDisplay,
} from "@/components/tournament/TournamentDisplay";

export function Hero({ sponsored }: { sponsored: Tournament[] }) {
  return (
    <section className="gradient-brand-page pt-16 max-[1000px]:pt-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-evenly gap-8 px-5 pb-12">
        <div className="mb-[30px]">
          {sponsored[0] ? (
            <TournamentDisplay tournament={sponsored[0]} />
          ) : (
            <EmptyTournamentDisplay />
          )}
        </div>
        <div className="mb-[30px]">
          {sponsored[1] ? (
            <TournamentDisplay tournament={sponsored[1]} />
          ) : (
            <EmptyTournamentDisplay />
          )}
        </div>
      </div>
    </section>
  );
}
