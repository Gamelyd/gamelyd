import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Catalog · Admin",
  description: "Manage games, sports, and other catalog kinds on Gamelyd.",
  path: "/admin/games",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminGamesLayout({ children }: { children: ReactNode }) {
  return children;
}
