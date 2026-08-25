import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Users · Admin",
  description: "Manage Gamelyd accounts.",
  path: "/admin/users",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminUsersLayout({ children }: { children: ReactNode }) {
  return children;
}
