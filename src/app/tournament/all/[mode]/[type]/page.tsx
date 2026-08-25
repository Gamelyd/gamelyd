import type { Metadata } from "next";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { browseTournamentsMeta, pageMeta } from "@/lib/seo";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  TournamentCard,
  EmptyTournaments,
} from "@/components/tournament/TournamentCard";
import { TournamentFilters } from "@/components/tournament/TournamentFilters";
import { Button } from "@/components/ui/Button";
import { getTournamentsByModeAction } from "@/server/actions/tournamentActions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mode: string; type: string }>;
}): Promise<Metadata> {
  const { mode, type } = await params;
  const copy = browseTournamentsMeta(mode, type);
  return pageMeta({
    title: copy.title,
    description: copy.description,
    path: `/tournament/all/${mode}/${type}`,
  });
}

export default async function TournamentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string; type: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { mode, type } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam ?? "1") || 1, 1);

  const result = await getTournamentsByModeAction(mode, type, page);
  const data = result.ok
    ? result.data
    : { items: [], total: 0, page, last_page: 1 };

  return (
    <SiteLayout>
      <PageHeader
        kicker="Compete"
        title="Tournaments"
        description={
          mode.toUpperCase() === "ALL" && type.toUpperCase() === "ALL"
            ? "Browse every tournament."
            : `Browse ${mode.toLowerCase()} ${type.toLowerCase()} tournaments.`
        }
        actions={
          <Link href="/tournament/new">
            <Button>Create tournament</Button>
          </Link>
        }
      />

      <section className="mx-auto max-w-7xl px-5 py-10">
        <TournamentFilters mode={mode} type={type} />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.length === 0 ? (
            <EmptyTournaments message="No tournaments match these filters yet." />
          ) : (
            data.items.map((t) => (
              <TournamentCard key={`${t._id}:${t.TournamentId}`} tournament={t} />
            ))
          )}
        </div>

        {data.last_page > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            {Array.from({ length: data.last_page }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/tournament/all/${mode}/${type}?page=${p}`}
                className={`rounded-lg px-4 py-2 text-sm ${
                  p === data.page
                    ? "bg-primary text-[#04201e]"
                    : "bg-surface text-body hover:text-white"
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
