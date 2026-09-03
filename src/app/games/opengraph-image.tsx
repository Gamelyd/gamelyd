import { ImageResponse } from "next/og";
import { DefaultOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Games and sports you can host on Gamelyd";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <DefaultOgMarkup
        kicker="Catalogue"
        title="Games and sports you can host"
        subtitle="Pick a title, then run knockout, groups, a league, or battle royale."
      />
    ),
    size,
  );
}
