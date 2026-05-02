// Next.js 16 — `proxy.ts` replaces `middleware.ts`.
// Protects all routes except /login and static assets.
// Validates the signed cookie set by `createSession` in src/lib/auth.ts.

import { NextResponse, type NextRequest } from "next/server"
import { isCookieValid } from "@/lib/auth"

const COOKIE_NAME = "wa_session"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    // /api/notify is protected by X-API-Key (called by n8n, not the browser).
    pathname.startsWith("/api/notify") ||
    // /api/files accepts cookie OR X-API-Key — auth is enforced inside the
    // route handler so n8n/the bot can fetch attachments.
    pathname.startsWith("/api/files") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!isCookieValid(cookie)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // skip Next internals and static files (extension filter)
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
}
