import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Create a tournament",
  description:
    "Set the game, format, roster size, and prizes. Invite-only is the default: the event is listed, and players register after they accept your invite.",
  path: "/tournament/new",
  noIndex: true,
});

export default function CreateTournamentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
