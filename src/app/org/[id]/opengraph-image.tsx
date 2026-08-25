import { ImageResponse } from "next/og";
import { getOrgById } from "@/server/services/orgService";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { orgShareDescription } from "@/lib/seo";
import { DefaultOgMarkup, EntityOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Organization";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrgById(id);
  if (!org) {
    return new ImageResponse(<DefaultOgMarkup title="Organization" />, size);
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
    size,
  );
}
