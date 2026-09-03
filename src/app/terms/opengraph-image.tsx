import { ImageResponse } from "next/og";
import { DefaultOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Gamelyd terms of service";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <DefaultOgMarkup
        kicker="Legal"
        title="Terms of Service"
        subtitle="How Gamelyd works: hosting, joining, plans, and conduct."
      />
    ),
    size,
  );
}
