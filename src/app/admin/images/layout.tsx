import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Images · Admin",
  description: "Manage tournament covers, team crests, and player tokens.",
  path: "/admin/images",
  noIndex: true,
  absoluteTitle: true,
});

export default function AdminImagesLayout({ children }: { children: ReactNode }) {
  return children;
}
