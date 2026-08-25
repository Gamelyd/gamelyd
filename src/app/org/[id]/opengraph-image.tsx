import { ImageResponse } from "next/og";
import { getOrgById } from "@/server/services/orgService";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { orgShareDescription } from "@/lib/seo";
import {
  DefaultOgMarkup,
  EntityOgMarkup,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Organization";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrgById(id);
  if (!org) {
    return new ImageResponse(<DefaultOgMarkup title="Organization" />, OG_SIZE);
  }

  return new ImageResponse(
    (
      <EntityOgMarkup
        image={resolveIcon(org.image, FALLBACKS.team)}
        kicker="Organization"
        title={org.name}
        subtitle={orgShareDescription(org).slice(0, 140)}
      />
    ),
    OG_SIZE,
  );
}
