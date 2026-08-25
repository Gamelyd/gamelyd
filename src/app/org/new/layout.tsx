import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Create an organization",
  description:
    "Host tournaments under your brand and invite teammates to help manage them.",
  path: "/org/new",
  noIndex: true,
});

export default function CreateOrgLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
