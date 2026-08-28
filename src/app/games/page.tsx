import type { Metadata } from "next";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GameTile } from "@/components/game/GameTile";
import { pageMeta } from "@/lib/seo";
import { getGamesPageAction } from "@/server/actions/gameActions";

const PER_PAGE = 12;

function gamesHref(search: string, page?: number): string {
  const params = new URLSearchParams();
  const q = search.trim();
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/games?${query}` : "/games";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const search = (q ?? "").trim();
  return pageMeta({
    title: search ? `Games · ${search}` : "Games",
    description:
      "Browse games you can host on Gamelyd. Search by name, then create a tournament.",
    path: search ? `/games?q=${encodeURIComponent(search)}` : "/games",
  });
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const search = (q ?? "").trim();
  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const result = await getGamesPageAction(search, page, PER_PAGE);
  const data = result.ok
    ? result.data
    : { items: [], total: 0, page, last_page: 1 };

  return (
    <SiteLayout>
      <PageHeader
        kicker="Titles"
        title="Games"
        description="Search the catalog by name. Pick a title when you create a tournament."
        actions={
          <Link href="/tournament/new">
            <Button>Create tournament</Button>
          </Link>
        }
      />

      <section className="mx-auto max-w-7xl px-5 py-10">
        <form action="/games" method="get" className="flex max-w-lg gap-3">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search games by name"
            aria-label="Search games by name"
          />
          <Button type="submit" variant="outline" className="shrink-0">
            Search
          </Button>
        </form>

        <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.items.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-primary/25 bg-primary-panel py-16 text-center text-body">
              {search
                ? `No games match “${search}”.`
                : "No games listed yet."}
            </p>
          ) : (
            data.items.map((game) => (
              <GameTile key={game.game_id} game={game} />
            ))
          )}
        </div>

        {data.last_page > 1 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {Array.from({ length: data.last_page }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={gamesHref(search, p)}
                className={`rounded-lg px-4 py-2 text-sm ${
                  p === data.page
                    ? "bg-primary text-[#04201e]"
                    : "border border-primary/25 bg-primary-panel text-body hover:text-white"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
