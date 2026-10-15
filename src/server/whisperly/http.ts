import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

/** Error with an HTTP status and a stable machine-readable code the app can switch on. */
export class WlError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function wlOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true as const, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function wlFail(code: string, error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false as const, code, error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Client IP (behind the ingress, from x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Reads the raw body once (needed for signature checks) and validates it with a zod schema. */
export async function readBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ raw: string; data: z.infer<S> }> {
  const raw = await req.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new WlError("BAD_JSON", "Expected JSON", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new WlError("INVALID_INPUT", first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input", 400);
  }
  return { raw, data: parsed.data };
}

/** Wraps a route handler: maps WlError to its status, anything else to a generic 500. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (error) {
      if (error instanceof WlError) return wlFail(error.code, error.message, error.status, error.extra);
      console.error("[whisperly]", error);
      return wlFail("SERVER_ERROR", "Something went wrong. Please try again.", 500);
    }
  };
}
