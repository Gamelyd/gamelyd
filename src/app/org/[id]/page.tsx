import { notFound } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { OrgView } from "@/components/org/OrgView";
import {
  getOrgAction,
  listMembersAction,
  listOrgTournamentsAction,
} from "@/server/actions/orgActions";

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
