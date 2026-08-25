import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getTournamentById } from "@/server/services/tournamentService";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  return pageMeta({
    title: tournament
      ? `Manage ${tournament.Name} · Admin`
      : "Manage tournament · Admin",
    description: tournament
      ? `Admin tools for ${tournament.Name}.`
      : "Manage a tournament in the Gamelyd admin.",
    path: `/admin/tournaments/${id}`,
    noIndex: true,
    absoluteTitle: true,
  });
}

export default function AdminTournamentDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
