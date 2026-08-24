import { notFound } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { TournamentView } from "@/components/tournament/TournamentView";
import { getTournamentById, listParticipants } from "@/server/services/tournamentService";
import { getDrawsByTournament } from "@/server/services/drawService";

export const dynamic = "force-dynamic";

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
