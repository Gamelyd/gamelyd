import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "gamelyd_token";
const REFRESH_COOKIE = "gamelyd_refresh";

/** Paths that require an authenticated session. */
const protectedPaths = ["/tournament/new", "/org/new", "/org", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedPaths.some((p) => pathname.startsWith(p));
  const hasSession =
    Boolean(request.cookies.get(SESSION_COOKIE)) ||
    Boolean(request.cookies.get(REFRESH_COOKIE));

  if (needsAuth && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/tournament/new/:path*",
    "/org/new/:path*",
    "/org",
    "/admin/:path*",
  ],
};
