import type { Metadata } from "next";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GameTile } from "@/components/game/GameTile";
import { pageMeta } from "@/lib/seo";
import { getGamesPageAction } from "@/server/actions/gameActions";
import { getCatalogKindsAction } from "@/server/actions/catalogKindActions";
import {
  DEFAULT_CATALOG_KINDS,
  GAMES_KIND,
  parseCatalogKind,
} from "@/lib/catalog";
import { PageTour } from "@/components/help/PageTour";
import { GAMES_TOUR } from "@/components/help/tours";
import { helpTarget } from "@/lib/help";

const PER_PAGE = 12;

function gamesHref(search: string, kind: string, page?: number): string {
  const params = new URLSearchParams();
  const q = search.trim();
  if (q) params.set("q", q);
  if (kind && kind !== "ALL" && kind !== GAMES_KIND) params.set("kind", kind);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/games?${query}` : "/games";
}

function catalogKindFromQuery(raw: string | undefined): string {
  const parsed = parseCatalogKind(raw);
  return parsed === "ALL" ? GAMES_KIND : parsed;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}): Promise<Metadata> {
  const { q, kind: kindParam } = await searchParams;
  const search = (q ?? "").trim();
  const kindSlug = catalogKindFromQuery(kindParam);
  const kindsResult = await getCatalogKindsAction();
  const kinds = kindsResult.ok ? kindsResult.data : DEFAULT_CATALOG_KINDS;
  const kindLabel =
    kinds.find((item) => item.slug === kindSlug)?.label ?? "Games";
  const title = search ? `${kindLabel} · ${search}` : kindLabel;
  return pageMeta({
    title,
    description: `Browse ${kindLabel.toLowerCase()} you can host on Gamelyd. Search by name, then create a tournament.`,
    path: gamesHref(search, kindSlug),
  });
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; kind?: string }>;
}) {
  const { q, page: pageParam, kind: kindParam } = await searchParams;
  const search = (q ?? "").trim();
  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const kindSlug = catalogKindFromQuery(kindParam);
  const [result, kindsResult] = await Promise.all([
    getGamesPageAction(search, page, PER_PAGE, kindSlug),
    getCatalogKindsAction(),
  ]);
  const data = result.ok
    ? result.data
    : { items: [], total: 0, page, last_page: 1 };
  const kinds = kindsResult.ok ? kindsResult.data : DEFAULT_CATALOG_KINDS;
  const kindLabel =
    kinds.find((item) => item.slug === kindSlug)?.label ?? "Games";
  const noun = kindLabel.toLowerCase();

  return (
    <SiteLayout>
      <PageTour tour={GAMES_TOUR} />
      <PageHeader
        title={kindLabel}
        description={`Search the ${noun} catalog by name. Pick a title when you create a tournament.`}
        actions={
          <Link href="/tournament/new" {...helpTarget("catalog-create")}>
            <Button>Create tournament</Button>
          </Link>
        }
      />

      <section className="mx-auto max-w-page px-page py-10">
        {kinds.length > 1 ? (
          <div className="mb-8 flex flex-wrap gap-2" {...helpTarget("catalog-kinds")}>
            {kinds.map((kind) => {
              const href = gamesHref(search, kind.slug);
              const active = kind.slug === kindSlug;
              return (
                <Link
                  key={kind.slug}
                  href={href}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-surface-2 bg-surface text-body hover:border-primary/40"
                  }`}
                >
                  {kind.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        <form
          action="/games"
          method="get"
          className="flex max-w-lg gap-3"
          {...helpTarget("catalog-search")}
        >
          {kindSlug !== GAMES_KIND ? (
            <input type="hidden" name="kind" value={kindSlug} />
          ) : null}
          <Input
            name="q"
            defaultValue={search}
            placeholder={`Search ${noun} by name`}
            aria-label={`Search ${noun} by name`}
          />
          <Button type="submit" variant="outline" className="shrink-0">
            Search
          </Button>
        </form>

        <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.items.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-primary/25 bg-primary-panel py-16 text-center text-body">
              {search
                ? `No ${noun} match “${search}”.`
                : `No ${noun} listed yet.`}
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
                href={gamesHref(search, kindSlug, p)}
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
