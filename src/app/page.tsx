import { SiteLayout } from "@/components/layout/SiteLayout";
import { Hero } from "@/components/home/Hero";
import { LatestTournaments } from "@/components/home/LatestTournaments";
import { HostCta } from "@/components/home/HostCta";
import { Leaderboard } from "@/components/home/Leaderboard";
import {
  HowItWorks,
  Formats,
  GamesStrip,
  Audience,
  HomeFaq,
} from "@/components/home/HomeContent";
import {
  getTournamentsAction,
  getBannerTournamentsAction,
} from "@/server/actions/tournamentActions";
import { getGamesAction } from "@/server/actions/gameActions";

export default async function HomePage() {
  const [bannerResult, latestResult, gamesResult] = await Promise.all([
    getBannerTournamentsAction(),
    getTournamentsAction("", 1),
    getGamesAction(),
  ]);
  const banner = bannerResult.ok ? bannerResult.data : [];
  const latest = latestResult.ok ? latestResult.data.items.slice(0, 10) : [];
  const games = gamesResult.ok ? gamesResult.data : [];

  return (
    <SiteLayout>
      <Hero banner={banner} />
      <HowItWorks />
      <LatestTournaments tournaments={latest} />
      <Formats />
      <GamesStrip games={games} />
      <Audience />
      <HostCta />
      <Leaderboard />
      <HomeFaq />
    </SiteLayout>
  );
}
