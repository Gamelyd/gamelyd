import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageTour } from "@/components/help/PageTour";
import { HOME_TOUR } from "@/components/help/tours";
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
import { GAMES_KIND, SPORTS_KIND } from "@/lib/catalog";

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
  const [bannerResult, latestResult, gamesResult, sportsResult] =
    await Promise.all([
      getBannerTournamentsAction(),
      getTournamentsAction("", 1),
      getGamesPageAction("", 1, 10, GAMES_KIND),
      getGamesPageAction("", 1, 10, SPORTS_KIND),
    ]);
  const banner = bannerResult.ok ? bannerResult.data : [];
  const latest = latestResult.ok ? latestResult.data.items.slice(0, 10) : [];
  const games = gamesResult.ok ? gamesResult.data.items : [];
  const sports = sportsResult.ok ? sportsResult.data.items : [];

  return (
    <SiteLayout>
      <PageTour tour={HOME_TOUR} />
      <Hero banner={banner} />
      <HowItWorks />
      <MoneyAndSafety />
      <LatestTournaments tournaments={latest} />
      <Formats />
      <GamesStrip games={games} />
      <GamesStrip
        games={sports}
        kicker="Pitch"
        title="Sports you can host"
        description="Football, basketball, and any sport you add. Pick a format like 5-a-side, then run knockout, groups, or a league."
        href="/games?kind=sports"
      />
      <Audience />
      <HostCta />
      <Leaderboard />
      <HomeFaq />
    </SiteLayout>
  );
}
