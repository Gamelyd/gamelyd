import { ImageResponse } from "next/og";
import { DefaultOgMarkup, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "Gamelyd — Host and join game tournaments";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(<DefaultOgMarkup />, OG_SIZE);
}
