import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageTour } from "@/components/help/PageTour";
import { HOME_TOUR } from "@/components/help/tours";
import { pageMeta } from "@/lib/seo";
import { Hero } from "@/components/home/Hero";
import { LatestTournaments } from "@/components/home/LatestTournaments";
import { Leaderboard } from "@/components/home/Leaderboard";
import {
  HowItWorks,
  FormatsAndGames,
  PlayersAndHosts,
  HomeFaq,
} from "@/components/home/HomeContent";
import {
  getTournamentsAction,
  getTournamentsByModeAction,
  getBannerTournamentsAction,
} from "@/server/actions/tournamentActions";
import { getGamesPageAction } from "@/server/actions/gameActions";
import { getLeaderboard } from "@/server/services/leaderboardService";
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
  const [
    bannerResult,
    latestResult,
    openResult,
    gamesResult,
    sportsResult,
    leaders,
  ] = await Promise.all([
    getBannerTournamentsAction(),
    getTournamentsAction("", 1),
    getTournamentsByModeAction("ALL", "ALL", 1, "REGISTRATION"),
    getGamesPageAction("", 1, 10, GAMES_KIND),
    getGamesPageAction("", 1, 10, SPORTS_KIND),
    getLeaderboard({
      payment: "ALL",
      games: [],
      metric: "matchesWon",
      limit: 5,
    }).catch(() => []),
  ]);

  const banner = bannerResult.ok ? bannerResult.data : [];
  const latest = latestResult.ok ? latestResult.data.items : [];
  const open = openResult.ok ? openResult.data : null;
  const games = gamesResult.ok ? gamesResult.data.items : [];
  const sports = sportsResult.ok ? sportsResult.data.items : [];

  // Lead with events people can still register for, and top up from the
  // general list so a quiet week still fills the row.
  const seen = new Set<string>();
  const shown = [...(open?.items ?? []), ...latest]
    .filter((t) => {
      if (seen.has(t.TournamentId)) return false;
      seen.add(t.TournamentId);
      return true;
    })
    .slice(0, 10);

  const stats = {
    tournaments: latestResult.ok ? latestResult.data.total : 0,
    open: open?.total ?? 0,
    titles:
      (gamesResult.ok ? gamesResult.data.total : 0) +
      (sportsResult.ok ? sportsResult.data.total : 0),
  };

  return (
    <SiteLayout>
      <PageTour tour={HOME_TOUR} />
      <Hero banner={banner} stats={stats} />
      <LatestTournaments tournaments={shown} />
      <HowItWorks />
      <FormatsAndGames games={games} sports={sports} />
      <PlayersAndHosts />
      <Leaderboard rows={leaders} />
      <HomeFaq />
    </SiteLayout>
  );
}
