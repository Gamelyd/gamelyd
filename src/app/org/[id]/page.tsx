import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { OrgView } from "@/components/org/OrgView";
import {
  getOrgAction,
  listMembersAction,
  listOrgTournamentsAction,
} from "@/server/actions/orgActions";
import { getOrgById } from "@/server/services/orgService";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { orgShareDescription, pageMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrgById(id);
  if (!org) return pageMeta({ title: "Organization", path: `/org/${id}` });

  return pageMeta({
    title: org.name,
    description: orgShareDescription(org),
    path: `/org/${org.org_id}`,
    image: resolveIcon(org.image, FALLBACKS.team),
    imageAlt: org.name,
  });
}

export default async function OrgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [orgResult, membersResult, tournamentsResult] = await Promise.all([
    getOrgAction(id),
    listMembersAction(id),
    listOrgTournamentsAction(id, 1),
  ]);

  if (!orgResult.ok || !orgResult.data) notFound();

  return (
    <SiteLayout>
      <OrgView
        org={orgResult.data}
        initialMembers={membersResult.ok ? membersResult.data : []}
        tournaments={tournamentsResult.ok ? tournamentsResult.data.items : []}
      />
    </SiteLayout>
  );
}
