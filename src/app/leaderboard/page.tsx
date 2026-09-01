import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageMeta } from "@/lib/seo";
import { getGamesAction } from "@/server/actions/gameActions";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const metadata: Metadata = pageMeta({
  title: "Leaderboard",
  description:
    "See the top players across Gamelyd, ranked by tournaments won or matches won. Filter by game and event type.",
  path: "/leaderboard",
});

export default async function LeaderboardPage() {
  const gamesResult = await getGamesAction();
  const games = gamesResult.ok
    ? gamesResult.data.map((g) => ({ name: g.name }))
    : [];

  return (
    <SiteLayout>
      <PageHeader
        kicker="Rankings"
        title="Leaderboard"
        description="The top players across Gamelyd. Rank by tournaments won or matches won, and filter by game or event type."
      />
      <section className="mx-auto max-w-page px-page py-10">
        <LeaderboardView games={games} />
      </section>
    </SiteLayout>
  );
}
