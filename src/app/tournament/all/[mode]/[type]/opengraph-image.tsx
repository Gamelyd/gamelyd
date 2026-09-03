import { ImageResponse } from "next/og";
import { DefaultOgMarkup } from "@/lib/ogCard";
import { browseTournamentsMeta } from "@/lib/seo";

export const runtime = "nodejs";
export const alt = "Browse tournaments on Gamelyd";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
 * Shares of a filtered list should say which list. The copy comes from the
 * same helper the page title uses, so the card and the tab never disagree.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ mode: string; type: string }>;
}) {
  const { type } = await params;
  const { title, description } = browseTournamentsMeta(type);

  return new ImageResponse(
    (
      <DefaultOgMarkup
        kicker="Browse"
        title={title}
        subtitle={description}
      />
    ),
    size,
  );
}
