import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { TournamentManageView } from "@/components/tournament/TournamentManageView";
import {
  canAdministerTournamentById,
  getTournamentById,
  listParticipants,
} from "@/server/services/tournamentService";
import { getDrawsByTournament } from "@/server/services/drawService";
import { resolveCurrentUser } from "@/server/services/userService";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  return pageMeta({
    title: tournament ? `Manage ${tournament.Name}` : "Manage tournament",
    description: "Add players and manage this tournament.",
    path: `/tournament/${id}/manage`,
    noIndex: true,
  });
}

export default async function TournamentManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await resolveCurrentUser();
  if (!user) redirect(`/signup?redirect=/tournament/${id}/manage`);

  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const allowed = await canAdministerTournamentById(user.user_id, id);
  if (!allowed) redirect(`/tournament/${tournament.TournamentId}`);

  const [participants, draws] = await Promise.all([
    listParticipants(id),
    getDrawsByTournament(id),
  ]);

  return (
    <SiteLayout>
      <TournamentManageView
        tournament={tournament}
        initialParticipants={participants}
        initialDraws={draws}
        isPlatformAdmin={user.user_type === "ADMIN"}
        canAdminister
      />
    </SiteLayout>
  );
}
