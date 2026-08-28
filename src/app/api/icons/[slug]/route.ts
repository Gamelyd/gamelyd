import { NextResponse } from "next/server";
import { getIconBuffer } from "@/server/iconFiles";

export const runtime = "nodejs";

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!/^[\w.-]+$/.test(slug)) return notFound();

  const found = await getIconBuffer(slug);
  if (!found) return notFound();

  const body = new Uint8Array(found.buffer);
  return new NextResponse(body, {
    headers: {
      "Content-Type": found.contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

export async function HEAD(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!/^[\w.-]+$/.test(slug)) return notFound();

  const found = await getIconBuffer(slug);
  if (!found) return notFound();

  return new NextResponse(null, {
    headers: {
      "Content-Type": found.contentType,
      "Content-Length": String(found.buffer.byteLength),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
