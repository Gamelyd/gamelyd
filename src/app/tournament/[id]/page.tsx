import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { TournamentView } from "@/components/tournament/TournamentView";
import { getTournamentById, listParticipants } from "@/server/services/tournamentService";
import { getDrawsByTournament } from "@/server/services/drawService";
import {
  publicAppUrl,
  tournamentShareDescription,
} from "@/lib/tournamentShare";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) return { title: "Tournament" };

  const title = `${tournament.Name} · ${tournament.GameName}`;
  const description = tournamentShareDescription(tournament);
  const url = `${publicAppUrl()}/tournament/${tournament.TournamentId}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: tournament.Name,
      description,
      url,
      siteName: "Gamelyd",
      type: "website",
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title: tournament.Name,
      description,
    },
  };
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
