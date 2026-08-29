import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Reports · Admin",
  description: "Issues raised by players and contact change requests.",
  path: "/admin/reports",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminReportsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
