"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  acceptOrgInviteAction,
  declineOrgInviteAction,
  getMyOrgInvitesAction,
} from "@/server/actions/orgActions";
import type { OrgInvite } from "@/lib/schemas/org";

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
      <section className="gradient-brand-page">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-12">
          <h1 className="font-display text-4xl text-white md:text-5xl">
            Organizations
          </h1>
          <Button variant="dark" onClick={() => router.push("/org/new")}>
            Create new
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        {invites.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Pending invites
            </h2>
            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <div
                  key={invite.invite_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-2 bg-surface p-4"
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

        <h2 className="mb-4 text-xl font-semibold text-white">
          Your organizations
        </h2>
        {orgs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-2 bg-surface/50 py-16 text-center text-body">
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
                className="flex items-center gap-4 rounded-2xl border border-surface-2 bg-surface p-5 transition-colors hover:border-primary/50"
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
                  <p className="truncate font-semibold text-white">
                    {org.name}
                  </p>
                  <span className="text-xs text-primary">{org.role}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
