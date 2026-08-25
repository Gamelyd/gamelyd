import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Hero } from "@/components/home/Hero";
import { LatestTournaments } from "@/components/home/LatestTournaments";
import { Leaderboard } from "@/components/home/Leaderboard";
import { Button } from "@/components/ui/Button";
import {
  getTournamentsAction,
  getTournamentsByModeLimitAction,
} from "@/server/actions/tournamentActions";

export default async function HomePage() {
  const [sponsoredResult, latestResult] = await Promise.all([
    getTournamentsByModeLimitAction("SPONSORED"),
    getTournamentsAction("", 1),
  ]);
  const sponsored = sponsoredResult.ok ? sponsoredResult.data : [];
  const latest = latestResult.ok ? latestResult.data.items.slice(0, 10) : [];

  return (
    <SiteLayout>
      <Hero sponsored={sponsored} />

      <LatestTournaments tournaments={latest} />

      <section className="stripes-home mt-5 h-[300px] max-[700px]:h-[200px]">
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[linear-gradient(to_right,rgba(31,39,49,0),#1f2731,rgba(31,39,49,0))] text-center">
          <h2 className="font-display text-[50px] leading-[93%] text-white max-[700px]:text-[30px]">
            CREATE TOURNAMENT
          </h2>
          <p className="font-body text-[18px] text-white max-[700px]:text-[13px]">
            Select a game to start a tournament
          </p>
          <Link href="/tournament/new">
            <Button variant="default">New Tournament</Button>
          </Link>
        </div>
      </section>

      <Leaderboard />
    </SiteLayout>
  );
}
