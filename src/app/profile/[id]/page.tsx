import { notFound } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProfileView } from "@/components/profile/ProfileView";
import { getUserAction } from "@/server/actions/userActions";
import {
  listUserTournamentsLimitAction,
  userRegisteredTournamentsLimitAction,
} from "@/server/actions/tournamentActions";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [userResult, createdResult, registeredResult] = await Promise.all([
    getUserAction(id),
    listUserTournamentsLimitAction(id),
    userRegisteredTournamentsLimitAction(id),
  ]);

  if (!userResult.ok || !userResult.data) notFound();

  return (
    <SiteLayout>
      <ProfileView
        profile={userResult.data}
        created={createdResult.ok ? createdResult.data : []}
        registered={registeredResult.ok ? registeredResult.data : []}
      />
    </SiteLayout>
  );
}
