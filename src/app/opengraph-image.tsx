import { ImageResponse } from "next/og";
import { DefaultOgMarkup } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Gamelyd: Host and join game tournaments";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<DefaultOgMarkup />, size);
}
