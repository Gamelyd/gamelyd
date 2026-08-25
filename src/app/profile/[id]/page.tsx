import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProfileView } from "@/components/profile/ProfileView";
import { getUserAction } from "@/server/actions/userActions";
import {
  listUserTournamentsLimitAction,
  userRegisteredTournamentsLimitAction,
} from "@/server/actions/tournamentActions";
import { getUserById } from "@/server/services/userService";
import { playerIconFor } from "@/lib/icons";
import { pageMeta, profileShareDescription } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) return pageMeta({ title: "Player", path: `/profile/${id}` });

  const name = `${user.first_name} ${user.last_name}`.trim() || user.user_name;
  return pageMeta({
    title: name,
    description: profileShareDescription(user),
    path: `/profile/${user.user_id}`,
    image: playerIconFor(user.user_id),
    imageAlt: name,
  });
}

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
