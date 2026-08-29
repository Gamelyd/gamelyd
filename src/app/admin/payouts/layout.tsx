import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Payouts · Admin",
  description: "Send prize money to tournament winners.",
  path: "/admin/payouts",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminPayoutsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
