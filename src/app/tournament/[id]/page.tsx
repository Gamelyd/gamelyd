import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { TournamentView } from "@/components/tournament/TournamentView";
import { getTournamentById, listParticipants } from "@/server/services/tournamentService";
import { getDrawsByTournament } from "@/server/services/drawService";
import {
  tournamentCoverUrl,
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
  if (!tournament) {
    return pageMeta({ title: "Tournament", path: `/tournament/${id}` });
  }

  const title = `${tournament.Name} · ${tournament.GameName}`;
  const image = tournamentCoverUrl(tournament);

  return pageMeta({
    title,
    description: tournamentShareDescription(tournament),
    path: `/tournament/${tournament.TournamentId}`,
    image,
    imageAlt: tournament.Name,
    absoluteTitle: true,
  });
}

export default async function SingleTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const [participants, draws] = await Promise.all([
    listParticipants(id),
    getDrawsByTournament(id),
  ]);

  return (
    <SiteLayout>
      <TournamentView
        tournament={tournament}
        initialParticipants={participants}
        initialDraws={draws}
      />
    </SiteLayout>
  );
}
