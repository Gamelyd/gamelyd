import "server-only";
import { getIconBuffer } from "./iconFiles";

/** Turn a catalog `/api/icons/{slug}` (or absolute URL to it) into a data URI for OG. */
export async function ogIconSrc(src: string): Promise<string> {
  const slug = catalogSlugFromSrc(src);
  if (slug) {
    const file = await getIconBuffer(slug);
    if (file) {
      return `data:${file.contentType};base64,${file.buffer.toString("base64")}`;
    }
  }
  return src;
}

function catalogSlugFromSrc(src: string): string | null {
  try {
    const path = src.startsWith("http://") || src.startsWith("https://")
      ? new URL(src).pathname
      : src;
    const match = path.match(/^\/api\/icons\/([\w.-]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
