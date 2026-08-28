import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Notifications",
  description: "Tournament and team invites on Gamelyd.",
  path: "/notifications",
  noIndex: true,
});

export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
