import { NextResponse } from "next/server";

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true as const, data }, { status });
}

export function apiFail(error: string, status = 400) {
  return NextResponse.json({ ok: false as const, error }, { status });
}
