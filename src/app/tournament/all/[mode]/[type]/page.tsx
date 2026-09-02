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
import {
  browseTournamentsHref,
  parseBrowseStatus,
} from "@/lib/tournamentStatus";
import {
  getTournamentsByModeAction,
  listHostingOrgsAction,
} from "@/server/actions/tournamentActions";
import { getCatalogKindsAction } from "@/server/actions/catalogKindActions";
import { DEFAULT_CATALOG_KINDS, parseCatalogKind } from "@/lib/catalog";
import { parseBrowseLocation } from "@/lib/venue";
import { PageTour } from "@/components/help/PageTour";
import { BROWSE_TOUR } from "@/components/help/tours";
import { helpTarget } from "@/lib/help";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mode: string; type: string }>;
}): Promise<Metadata> {
  const { mode, type } = await params;
  const copy = browseTournamentsMeta(type);
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
  searchParams: Promise<{
    page?: string;
    status?: string;
    kind?: string;
    country?: string;
    place?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    org?: string;
  }>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  const page = Math.max(Number(sp.page ?? "1") || 1, 1);
  const status = parseBrowseStatus(sp.status);
  const kind = parseCatalogKind(sp.kind);
  const location = parseBrowseLocation(sp);
  const org = (sp.org ?? "").trim();

  const [result, kindsResult, orgsResult] = await Promise.all([
    // Payment is no longer a browse dimension; always list across all entries.
    getTournamentsByModeAction("ALL", type, page, status, kind, location, org),
    getCatalogKindsAction(),
    listHostingOrgsAction(),
  ]);
  const data = result.ok
    ? result.data
    : { items: [], total: 0, page, last_page: 1 };
  const kinds = kindsResult.ok ? kindsResult.data : DEFAULT_CATALOG_KINDS;
  const orgs = orgsResult.ok ? orgsResult.data : [];

  return (
    <SiteLayout>
      <PageTour tour={BROWSE_TOUR} />
      <PageHeader
        title="Tournaments"
        description={
          type.toUpperCase() === "ALL"
            ? "Browse every tournament. Filter sports by country or what’s near you."
            : `Browse ${type.toLowerCase()} tournaments.`
        }
        actions={
          <Link href="/tournament/new" {...helpTarget("browse-create")}>
            <Button>Create tournament</Button>
          </Link>
        }
      />

      <section className="mx-auto max-w-page px-page py-10">
        <TournamentFilters
          type={type}
          status={status}
          kind={kind}
          kinds={kinds.map((item) => ({ slug: item.slug, label: item.label }))}
          location={location}
          org={org}
          orgs={orgs}
        />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.length === 0 ? (
            <EmptyTournaments message="No tournaments match these filters yet." />
          ) : (
            data.items.map((t) => (
              <div
                key={`${t._id}:${t.TournamentId}`}
                className="create-game-card"
              >
                <TournamentCard
                  tournament={t}
                  from={
                    location.lat != null && location.lng != null
                      ? { lat: location.lat, lng: location.lng }
                      : undefined
                  }
                />
              </div>
            ))
          )}
        </div>

        {data.last_page > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            {Array.from({ length: data.last_page }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={browseTournamentsHref({
                  payment: "ALL",
                  type,
                  status,
                  page: p,
                  kind,
                  country: location.country,
                  place: location.place,
                  lat: location.lat,
                  lng: location.lng,
                  radius: location.radius,
                  org,
                })}
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
