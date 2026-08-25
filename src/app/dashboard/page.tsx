import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { DashboardView } from "@/components/profile/DashboardView";
import { resolveCurrentUser } from "@/server/services/userService";
import {
  listUserTournamentsLimit,
  userRegisteredTournamentsLimit,
} from "@/server/services/tournamentService";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Dashboard",
  description: "Tournaments you host and events you have registered for.",
  path: "/dashboard",
  noIndex: true,
});

export default async function DashboardPage() {
  const profile = await resolveCurrentUser();
  if (!profile) redirect("/signup?redirect=/dashboard");

  const [created, registered] = await Promise.all([
    listUserTournamentsLimit(profile.user_id, 20),
    userRegisteredTournamentsLimit(profile.user_id),
  ]);

  return (
    <SiteLayout>
      <DashboardView
        profile={profile}
        created={created}
        registered={registered}
      />
    </SiteLayout>
  );
}
