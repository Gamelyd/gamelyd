import { ImageResponse } from "next/og";
import { getUserById } from "@/server/services/userService";
import { playerIconForUser } from "@/server/services/iconService";
import { ogIconSrc } from "@/server/ogIcon";
import { profileShareDescription } from "@/lib/seo";
import { DefaultOgMarkup, EntityOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Player profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) {
    return new ImageResponse(<DefaultOgMarkup title="Player" />, size);
  }

  const name = `${user.first_name} ${user.last_name}`.trim();
  return new ImageResponse(
    (
      <EntityOgMarkup
        image={await ogIconSrc(await playerIconForUser(user.user_id))}
        kicker="Player"
        title={name || user.user_name}
        subtitle={profileShareDescription(user).slice(0, 140)}
      />
    ),
    size,
  );
}
