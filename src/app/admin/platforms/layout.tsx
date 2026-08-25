import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Platforms · Admin",
  description: "Manage playable platforms on Gamelyd.",
  path: "/admin/platforms",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminPlatformsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
