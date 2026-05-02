"use server"

import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { updateOwnPassword } from "@/lib/db"

export type ChangePasswordState = {
  ok?: boolean
  error?: string
} | null

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const current = String(formData.get("current_password") ?? "")
  const next = String(formData.get("new_password") ?? "")
  const confirm = String(formData.get("confirm_password") ?? "")

  if (!current || !next || !confirm) {
    return { error: "Tous les champs sont requis." }
  }
  if (next !== confirm) {
    return { error: "Les deux nouveaux mots de passe ne correspondent pas." }
  }
  if (next === current) {
    return { error: "Le nouveau mot de passe doit différer de l'actuel." }
  }
  if (next.length < 4) {
    return { error: "Mot de passe trop court (min 4 caractères)." }
  }

  const result = updateOwnPassword(session.id, current, next)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: session.username,
    action: "change_password",
    target: String(session.id),
  })
  return { ok: true }
}
