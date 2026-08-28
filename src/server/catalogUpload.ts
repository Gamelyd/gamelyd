import "server-only";
import { putIconFile } from "./iconFiles";
import {
  createIcon,
  getIconBySlug,
  updateIcon,
} from "./services/iconService";
import { getGameById, updateGame } from "./services/gameService";
import type { IconAsset, IconKind } from "@/lib/schemas/icon";

export const MAX_CATALOG_IMAGE_BYTES = 6 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function slugFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  return (
    stem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

export function contentTypeForFile(
  filename: string,
  mime = "",
): string | null {
  if (IMAGE_TYPES.has(mime)) return mime;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

export function nameFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return base.replace(/\.[^.]+$/, "").trim().slice(0, 80);
}

export async function ingestCatalogImage(input: {
  filename: string;
  buffer: Buffer;
  contentType: string;
  name: string;
  kind: IconKind;
  gameIds: string[];
  setCover?: boolean;
}): Promise<{ icon: IconAsset; skipped: boolean; coverSet: boolean }> {
  const slug = slugFromFilename(input.filename);
  const gameIds = [...new Set(input.gameIds.filter(Boolean))];
  const existing = await getIconBySlug(slug);

  let icon: IconAsset;
  let skipped = false;
  if (existing) {
    skipped = true;
    const merged = [...new Set([...existing.gameIds, ...gameIds])];
    icon =
      merged.length === existing.gameIds.length
        ? existing
        : await updateIcon(existing.icon_id, { gameIds: merged });
  } else {
    await putIconFile(slug, input.buffer, input.contentType);
    icon = await createIcon(
      {
        name: input.name.trim().slice(0, 80) || slug,
        kind: input.kind,
        gameIds,
        url: `/api/icons/${slug}`,
      },
      { slug },
    );
  }

  let coverSet = false;
  if (input.setCover && gameIds[0]) {
    const game = await getGameById(gameIds[0]);
    if (game && !game.image) {
      await updateGame(game.game_id, { image: icon.url });
      coverSet = true;
    }
  }

  return { icon, skipped, coverSet };
}
