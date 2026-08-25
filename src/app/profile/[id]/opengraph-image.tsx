import { ImageResponse } from "next/og";
import { getUserById } from "@/server/services/userService";
import { playerIconFor } from "@/lib/icons";
import { profileShareDescription } from "@/lib/seo";
import {
  DefaultOgMarkup,
  EntityOgMarkup,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Player profile";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) {
    return new ImageResponse(<DefaultOgMarkup title="Player" />, OG_SIZE);
  }

  const name = `${user.first_name} ${user.last_name}`.trim();
  return new ImageResponse(
    (
      <EntityOgMarkup
        image={playerIconFor(user.user_id)}
        kicker="Player"
        title={name || user.user_name}
        subtitle={profileShareDescription(user).slice(0, 140)}
      />
    ),
    OG_SIZE,
  );
}
