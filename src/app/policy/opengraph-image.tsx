import { ImageResponse } from "next/og";
import { DefaultOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Gamelyd privacy policy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <DefaultOgMarkup
        kicker="Legal"
        title="Privacy Policy"
        subtitle="What we collect, why we collect it, and how it is handled."
      />
    ),
    size,
  );
}
