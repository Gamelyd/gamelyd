import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getIconFile } from "@/server/iconFiles";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!/^[\w.-]+$/.test(slug)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const found = await getIconFile(slug);
  if (!found) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(
    Readable.toWeb(found.stream) as unknown as ReadableStream,
    {
      headers: {
        "Content-Type": found.contentType,
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
