import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getOrgByIdAdmin } from "@/server/services/orgService";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrgByIdAdmin(id);
  return pageMeta({
    title: org ? `${org.name} · Admin` : "Organization · Admin",
    description: org
      ? `Admin tools for ${org.name}.`
      : "Manage an organization in the Gamelyd admin.",
    path: `/admin/orgs/${id}`,
    noIndex: true,
    absoluteTitle: true,
  });
}

export default function AdminOrgDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
