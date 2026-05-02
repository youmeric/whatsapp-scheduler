// Cookie-based session auth backed by SQLite.
// Users live in the `users` table (see lib/db.ts).
// Session is a signed cookie: "<username>.<hmac(username)>" — we re-fetch
// the user's role from DB on each request so revocation is immediate.

import { cookies } from "next/headers"
import crypto from "node:crypto"
import {
  findUserByUsername,
  verifyPassword,
  type Role,
} from "./db"

const COOKIE_NAME = "wa_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 1 week

export type SessionUser = {
  id: number
  username: string
  role: Role
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET env var is required and must be at least 16 chars. Set it in .env.local"
    )
  }
  return secret
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex")
}

export function verifyCredentials(
  username: string,
  password: string
): SessionUser | null {
  const u = findUserByUsername(username)
  if (!u) return null
  if (!verifyPassword(password, u.password_hash)) return null
  return { id: u.id, username: u.username, role: u.role }
}

export async function createSession(username: string): Promise<void> {
  const cookieStore = await cookies()
  const value = `${username}.${sign(username)}`
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie) return null
  const [username, signature] = cookie.value.split(".")
  if (!username || !signature) return null
  if (sign(username) !== signature) return null

  // Re-fetch from DB on each request (cheap, sync, in-process SQLite).
  const u = findUserByUsername(username)
  if (!u) return null
  return { id: u.id, username: u.username, role: u.role }
}

/** For proxy.ts: only checks the cookie signature (no DB lookup), since proxy runs on every request. */
export function isCookieValid(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false
  const [username, signature] = cookieValue.split(".")
  if (!username || !signature) return false
  try {
    return sign(username) === signature
  } catch {
    return false
  }
}
