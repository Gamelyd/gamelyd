import { apiFail, apiOk } from "@/lib/apiJson";
import { iconKindSchema } from "@/lib/schemas/icon";
import { guardAdmin } from "@/server/auth/admin";
import {
  MAX_CATALOG_IMAGE_BYTES,
  contentTypeForFile,
  ingestCatalogImage,
  nameFromFilename,
} from "@/server/catalogUpload";
import { ServiceError } from "@/server/services/userService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await guardAdmin())) return apiFail("Admin access required", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiFail("Expected multipart form data", 400);
  }

  const raw = form.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return apiFail("Select an image file", 400);
  }
  if (raw.size > MAX_CATALOG_IMAGE_BYTES) {
    return apiFail("Image must be 6 MB or smaller", 400);
  }
  const contentType = contentTypeForFile(raw.name, raw.type);
  if (!contentType) return apiFail("Use a PNG, JPEG, WebP, or GIF", 400);

  const kindParsed = iconKindSchema.safeParse(
    String(form.get("kind") || "tournament"),
  );
  if (!kindParsed.success) return apiFail("Pick a kind", 400);

  const gameId = String(form.get("gameId") ?? "").trim();
  const name =
    String(form.get("name") ?? "").trim() || nameFromFilename(raw.name);
  const setCover = String(form.get("setCover") ?? "") === "true";

  try {
    const result = await ingestCatalogImage({
      filename: raw.name,
      buffer: Buffer.from(await raw.arrayBuffer()),
      contentType,
      name,
      kind: kindParsed.data,
      gameIds: gameId ? [gameId] : [],
      setCover,
    });
    return apiOk(result);
  } catch (error) {
    if (error instanceof ServiceError) return apiFail(error.message, 400);
    console.error(error);
    return apiFail("Could not upload image", 500);
  }
}
