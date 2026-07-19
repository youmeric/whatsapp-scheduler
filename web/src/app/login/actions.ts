"use server"

import { createSession, verifyCredentials } from "@/lib/auth"

export type LoginState =
  | { error?: string }
  | { ok: true; redirectTo: string }
  | null

/**
 * Only allow internal, absolute paths as a redirect target.
 * Rejects protocol-relative ("//evil.com") and external URLs — otherwise a
 * crafted `?from=` could turn the login into an open redirect.
 */
function safeRedirect(from: string): string {
  if (from.startsWith("/") && !from.startsWith("//")) return from
  return "/messages"
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const from = String(formData.get("from") ?? "/messages")

  if (!username || !password) {
    return { error: "Identifiant et mot de passe requis." }
  }

  if (!verifyCredentials(username, password)) {
    return { error: "Identifiants incorrects." }
  }

  await createSession(username)
  // Don't redirect() here: the Set-Cookie from createSession() must be
  // committed by the browser before we navigate, otherwise the proxy doesn't
  // see the session on the first request and the page fails to load. We return
  // the target and let the client do a full navigation (see login-form.tsx).
  return { ok: true, redirectTo: safeRedirect(from) }
}
