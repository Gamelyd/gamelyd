"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  acceptOrgInviteAction,
  declineOrgInviteAction,
  getMyOrgInvitesAction,
} from "@/server/actions/orgActions";
import type { OrgInvite } from "@/lib/schemas/org";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { PageTour } from "@/components/help/PageTour";
import { ORG_TOUR } from "@/components/help/tours";
import { helpTarget } from "@/lib/help";

export default function OrgsIndexPage() {
  const { isAuthenticated, orgs, refreshOrgs } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.push("/signup?redirect=/org");
  }, [isAuthenticated, router]);

  useEffect(() => {
    let active = true;
    void getMyOrgInvitesAction().then((result) => {
      if (active && result.ok) setInvites(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const respond = async (invite: OrgInvite, accept: boolean) => {
    setBusyId(invite.invite_id);
    const result = accept
      ? await acceptOrgInviteAction(invite.invite_id)
      : await declineOrgInviteAction(invite.invite_id);
    setBusyId(null);
    if (result.ok) {
      toast.success(result.message ?? "Done");
      setInvites((prev) =>
        prev.filter((i) => i.invite_id !== invite.invite_id),
      );
      if (accept) await refreshOrgs();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <SiteLayout>
      <PageTour tour={ORG_TOUR} />
      <PageHeader
        title="Organizations"
        description="Host events under a shared brand and invite people to help run them."
        width="max-w-6xl"
        actions={
          <Button onClick={() => router.push("/org/new")} {...helpTarget("org-create")}>
            Create new
          </Button>
        }
      />

      <section className="mx-auto max-w-6xl px-page py-10">
        {invites.length > 0 && (
          <div className="mb-10" {...helpTarget("org-invites")}>
            <h2 className="mb-4 font-display text-2xl text-white">
              Pending invites
            </h2>
            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <div
                  key={invite.invite_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary-panel p-4"
                >
                  <p className="text-sm text-white">
                    You&apos;ve been invited to join{" "}
                    <span className="font-semibold text-primary">
                      {invite.org_name}
                    </span>{" "}
                    as {invite.role}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      loading={busyId === invite.invite_id}
                      onClick={() => respond(invite, true)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="dark"
                      loading={busyId === invite.invite_id}
                      onClick={() => respond(invite, false)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div {...helpTarget("org-list")}>
        <h2 className="mb-4 font-display text-2xl text-white">
          Your organizations
        </h2>
        {orgs.length === 0 ? (
          <div className="arena-panel py-16 text-center text-body">
            You don&apos;t belong to any organizations yet.{" "}
            <Link href="/org/new" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <Link
                key={org.org_id}
                href={`/org/${org.org_id}`}
                className="arena-panel flex items-center gap-4 p-5 hover:border-primary"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-4">
                  {org.image ? (
                    <Image
                      src={org.image}
                      alt={org.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl font-bold text-white">
                      {org.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <VerifiedName
                    as="p"
                    name={org.name}
                    verified={org.verified}
                    className="font-semibold text-white"
                  />
                  <span className="text-xs text-primary">{org.role}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </section>
    </SiteLayout>
  );
}
