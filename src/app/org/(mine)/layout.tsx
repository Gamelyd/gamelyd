import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Organizations",
  description:
    "Host events under a shared brand and invite people to help run them.",
  path: "/org",
  noIndex: true,
});

export default function OrgSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
