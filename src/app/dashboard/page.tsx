import { redirect } from "next/navigation";
import { resolveCurrentUser } from "@/server/services/userService";

export const dynamic = "force-dynamic";

/**
 * The dashboard was merged into the profile. Kept as a redirect so existing
 * links, bookmarks and the post-login destination keep working.
 */
export default async function DashboardPage() {
  const profile = await resolveCurrentUser();
  if (!profile) redirect("/signup?redirect=/dashboard");
  redirect(`/profile/${profile.user_id}`);
}
