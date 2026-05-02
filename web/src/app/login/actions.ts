"use server"

import { redirect } from "next/navigation"
import { createSession, verifyCredentials } from "@/lib/auth"

export type LoginState = { error?: string } | null

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
  redirect(from || "/messages")
}
