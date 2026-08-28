import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { pageMeta } from "@/lib/seo";
import { Hero } from "@/components/home/Hero";
import { LatestTournaments } from "@/components/home/LatestTournaments";
import { HostCta } from "@/components/home/HostCta";
import { Leaderboard } from "@/components/home/Leaderboard";
import {
  HowItWorks,
  MoneyAndSafety,
  Formats,
  GamesStrip,
  Audience,
  HomeFaq,
} from "@/components/home/HomeContent";
import {
  getTournamentsAction,
  getBannerTournamentsAction,
} from "@/server/actions/tournamentActions";
import { getGamesPageAction } from "@/server/actions/gameActions";

const homeTitle = "Gamelyd: Host and join game tournaments";
const homeDescription =
  "Create a tournament, register teams, draw fixtures, and keep scores in one place: leagues, groups, knockouts, and battle royale.";

export const metadata: Metadata = pageMeta({
  title: homeTitle,
  description: homeDescription,
  path: "/",
  absoluteTitle: true,
});

export default async function HomePage() {
  const [bannerResult, latestResult, gamesResult] = await Promise.all([
    getBannerTournamentsAction(),
    getTournamentsAction("", 1),
    getGamesPageAction("", 1, 10),
  ]);
  const banner = bannerResult.ok ? bannerResult.data : [];
  const latest = latestResult.ok ? latestResult.data.items.slice(0, 10) : [];
  const games = gamesResult.ok ? gamesResult.data.items : [];

  return (
    <SiteLayout>
      <Hero banner={banner} />
      <HowItWorks />
      <MoneyAndSafety />
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
