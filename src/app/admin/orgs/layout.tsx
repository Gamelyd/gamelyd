import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Organizations · Admin",
  description: "Manage organizations on Gamelyd.",
  path: "/admin/orgs",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminOrgsLayout({ children }: { children: ReactNode }) {
  return children;
}
