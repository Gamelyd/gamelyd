import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { guardAdmin } from "@/server/auth/admin";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AdminShell } from "@/components/admin/AdminShell";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Admin",
  description: "Gamelyd administration.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const claims = await guardAdmin();
  if (!claims) redirect("/");

  return (
    <SiteLayout>
      <AdminShell>{children}</AdminShell>
    </SiteLayout>
  );
}
