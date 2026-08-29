import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Settings · Admin",
  description: "Platform-wide configuration.",
  path: "/admin/settings",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
