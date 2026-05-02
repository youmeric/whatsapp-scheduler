"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
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
