import { ImageResponse } from "next/og";
import { DefaultOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Gamelyd pricing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <DefaultOgMarkup
        kicker="Pricing"
        title="Free to play. Free to run."
        subtitle="Free to create and join. Plans only when you organise at scale."
      />
    ),
    size,
  );
}
