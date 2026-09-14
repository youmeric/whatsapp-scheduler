"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import {
  createRecipientGroup,
  deleteRecipientGroup,
  findRecipientGroupById,
  isAdminOrAbove,
  updateRecipientGroup,
} from "@/lib/db"
import { postRecipient, deleteRecipient } from "@/lib/data"
import { digitsOnly, toWhatsappAddress } from "@/lib/phone"

export type RecipientActionState = {
  ok?: boolean
  error?: string
} | null

export async function createRecipientAction(
  _prev: RecipientActionState,
  formData: FormData
): Promise<RecipientActionState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const nom = String(formData.get("nom") ?? "").trim()
  const numeroInput = String(formData.get("numero") ?? "").trim()

  if (!nom) return { error: "Le nom est obligatoire." }
  if (!numeroInput) return { error: "Le numéro est obligatoire." }

  const digits = digitsOnly(numeroInput)
  if (digits.length < 8) {
    return { error: "Numéro trop court (au moins 8 chiffres)." }
  }

  const address = toWhatsappAddress(numeroInput) // "<digits>@c.us"
  const result = await postRecipient({
    nom,
    numero: address,
  })

  if (!result.ok) {
    return { error: `Erreur : ${result.error}` }
  }

  logAudit({
    username: session.username,
    action: "create_recipient",
    target: address,
    details: { nom },
  })
  revalidatePath("/recipients")
  revalidatePath("/messages") // recipient names appear in the messages table
  revalidatePath("/messages/new") // recipient list in the form
  return { ok: true }
}

export async function deleteRecipientAction(
  formData: FormData
): Promise<RecipientActionState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const nom = String(formData.get("nom") ?? "").trim()
  const numero = String(formData.get("numero") ?? "").trim()
  if (!nom) return { error: "Nom manquant." }
  if (!numero) return { error: "Numéro manquant." }

  const result = await deleteRecipient(nom, numero)
  if (!result.ok) {
    return { error: `Erreur : ${result.error}` }
  }

  logAudit({
    username: session.username,
    action: "delete_recipient",
    target: numero,
    details: { nom },
  })
  revalidatePath("/recipients")
  revalidatePath("/messages")
  revalidatePath("/messages/new")
  return { ok: true }
}

// ---------- Groupes de destinataires ----------

export type GroupActionState = {
  ok?: boolean
  error?: string
  id?: number
} | null

function parseNumeros(formData: FormData): string[] {
  // Le formulaire envoie "numeros" en CSV (chiffres).
  return String(formData.get("numeros") ?? "")
    .split(",")
    .map((s) => digitsOnly(s))
    .filter(Boolean)
}

export async function createGroupAction(
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const nom = String(formData.get("nom") ?? "").trim()
  const numeros = parseNumeros(formData)
  const result = createRecipientGroup(nom, numeros, session.username)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: session.username,
    action: "create_group",
    target: `group:${result.id}`,
    details: { nom, membres: numeros.length },
  })
  revalidatePath("/recipients")
  revalidatePath("/messages/new")
  return { ok: true, id: result.id }
}

export async function updateGroupAction(
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const id = Number(formData.get("id"))
  if (!Number.isFinite(id) || id <= 0) return { error: "ID invalide." }
  const target = findRecipientGroupById(id)
  if (!target) return { error: "Groupe introuvable." }
  if (
    !isAdminOrAbove(session.role) &&
    target.cree_par !== session.username
  ) {
    return { error: "Tu ne peux modifier que tes propres groupes." }
  }

  const nom = String(formData.get("nom") ?? "").trim()
  const numeros = parseNumeros(formData)
  const result = updateRecipientGroup(id, { nom, numeros })
  if (!result.ok) return { error: result.error }

  logAudit({
    username: session.username,
    action: "update_group",
    target: `group:${id}`,
  })
  revalidatePath("/recipients")
  revalidatePath("/messages/new")
  return { ok: true }
}

export async function deleteGroupAction(
  formData: FormData
): Promise<GroupActionState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const id = Number(formData.get("id"))
  if (!Number.isFinite(id) || id <= 0) return { error: "ID invalide." }
  const target = findRecipientGroupById(id)
  if (!target) return { error: "Groupe introuvable." }
  if (
    !isAdminOrAbove(session.role) &&
    target.cree_par !== session.username
  ) {
    return { error: "Tu ne peux supprimer que tes propres groupes." }
  }

  const result = deleteRecipientGroup(id)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: session.username,
    action: "delete_group",
    target: `group:${id}`,
  })
  revalidatePath("/recipients")
  revalidatePath("/messages/new")
  return { ok: true }
}
