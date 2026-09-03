import { ImageResponse } from "next/og";
import { DefaultOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "About Gamelyd";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <DefaultOgMarkup
        kicker="About"
        title="Built for the night you are already running"
        subtitle="One page for signup, draws, fixtures, tables, and the bracket."
      />
    ),
    size,
  );
}
