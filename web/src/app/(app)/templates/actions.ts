"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import {
  createTemplate,
  deleteTemplate,
  findTemplateById,
  isAdminOrAbove,
  updateTemplate,
} from "@/lib/db"

export type TemplateActionState = {
  ok?: boolean
  error?: string
  id?: number
} | null

export async function createTemplateAction(
  _prev: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const nom = String(formData.get("nom") ?? "").trim()
  const contenu = String(formData.get("contenu") ?? "").trim()
  const result = createTemplate(nom, contenu, session.username)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: session.username,
    action: "create_template",
    target: String(result.id),
    details: { nom },
  })
  revalidatePath("/templates")
  return { ok: true, id: result.id }
}

export async function updateTemplateAction(
  _prev: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const idRaw = Number(formData.get("id"))
  if (!Number.isFinite(idRaw) || idRaw <= 0) {
    return { error: "ID invalide." }
  }
  const id = Number(idRaw)

  const target = findTemplateById(id)
  if (!target) return { error: "Modèle introuvable." }

  // Author or admin can edit.
  if (
    !isAdminOrAbove(session.role) &&
    target.cree_par !== session.username
  ) {
    return { error: "Tu ne peux modifier que tes propres modèles." }
  }

  const nom = String(formData.get("nom") ?? "").trim()
  const contenu = String(formData.get("contenu") ?? "").trim()
  const result = updateTemplate(id, { nom, contenu })
  if (!result.ok) return { error: result.error }

  logAudit({
    username: session.username,
    action: "update_template",
    target: String(id),
  })
  revalidatePath("/templates")
  return { ok: true }
}

export async function deleteTemplateAction(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const idRaw = Number(formData.get("id"))
  if (!Number.isFinite(idRaw) || idRaw <= 0) {
    return { error: "ID invalide." }
  }
  const id = Number(idRaw)

  const target = findTemplateById(id)
  if (!target) return { error: "Modèle introuvable." }

  if (
    !isAdminOrAbove(session.role) &&
    target.cree_par !== session.username
  ) {
    return { error: "Tu ne peux supprimer que tes propres modèles." }
  }

  const result = deleteTemplate(id)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: session.username,
    action: "delete_template",
    target: String(id),
  })
  revalidatePath("/templates")
  return { ok: true }
}
