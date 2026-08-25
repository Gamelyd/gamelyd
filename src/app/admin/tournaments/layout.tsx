import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Tournaments · Admin",
  description: "Manage tournaments on Gamelyd.",
  path: "/admin/tournaments",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminTournamentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
