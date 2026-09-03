import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PoweredBy } from "@/components/layout/PoweredBy";
import { TournamentView } from "@/components/tournament/TournamentView";
import { getTournamentById, listParticipants } from "@/server/services/tournamentService";
import { getDrawsByTournament } from "@/server/services/drawService";
import { limitsForHost } from "@/server/services/planService";
import {
  tournamentShareDescription,
} from "@/lib/tournamentShare";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament || tournament.IsDeleted) {
    return pageMeta({ title: "Tournament", path: `/tournament/${id}` });
  }

  const title = `${tournament.Name} · ${tournament.GameName}`;

  return pageMeta({
    title,
    description: tournamentShareDescription(tournament),
    path: `/tournament/${tournament.TournamentId}`,
    image: `/tournament/${tournament.TournamentId}/opengraph-image`,
    imageAlt: tournament.Name,
    absoluteTitle: true,
  });
}

export default async function SingleTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; checkout?: string }>;
}) {
  const { id } = await params;
  const { tab, checkout } = await searchParams;

  const tournament = await getTournamentById(id);
  if (!tournament || tournament.IsDeleted) notFound();

  const [participants, draws, hostLimits] = await Promise.all([
    listParticipants(id),
    getDrawsByTournament(id),
    // The credit belongs to whoever runs the event, so it follows the host's
    // plan rather than the viewer's.
    limitsForHost(tournament.User_id, tournament.OrgId || undefined),
  ]);

  return (
    <SiteLayout>
      <TournamentView
        tournament={tournament}
        initialParticipants={participants}
        initialDraws={draws}
        initialTab={
          tab === "register" || tab === "invite" ? tab : undefined
        }
        checkout={checkout}
      />
      <PoweredBy show={hostLimits.showsAttribution} />
    </SiteLayout>
  );
}
