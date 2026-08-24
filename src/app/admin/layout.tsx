import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { guardAdmin } from "@/server/auth/admin";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AdminShell } from "@/components/admin/AdminShell";

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
