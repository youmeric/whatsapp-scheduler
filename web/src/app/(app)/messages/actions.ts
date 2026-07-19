"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { randomUUID } from "node:crypto"
import { getSession } from "@/lib/auth"
import { isAdminOrAbove } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { nowLocalDateTime } from "@/lib/datetime"
import {
  deleteMessage,
  getMessages,
  postMessage,
  putMessage,
} from "@/lib/data"

export type CreateMessageState = { error?: string; created?: number } | null

const TIME_RE = /^([0-1]\d|2[0-3]):([0-5]\d)$/

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setMonth(dt.getMonth() + months)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

export async function createMessageAction(
  _prev: CreateMessageState,
  formData: FormData
): Promise<CreateMessageState> {
  const session = await getSession()
  if (!session) {
    return { error: "Session expirée." }
  }

  const date_envoi = String(formData.get("date_envoi") ?? "")
  const heure_envoi_raw = String(formData.get("heure_envoi") ?? "").trim()
  // Multiple recipients: "destinataires" is a comma-separated list of
  // "<digits>@c.us" addresses. Fall back to the legacy single "destinataire"
  // field for backward compatibility (e.g. during a rolling deploy).
  const destinataires = Array.from(
    new Set(
      String(formData.get("destinataires") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
  if (destinataires.length === 0) {
    const single = String(formData.get("destinataire") ?? "").trim()
    if (single) destinataires.push(single)
  }
  const message = String(formData.get("message") ?? "").trim()
  const attachment_url_raw = String(formData.get("attachment_url") ?? "").trim()
  const attachment_filename_raw = String(
    formData.get("attachment_filename") ?? ""
  ).trim()

  // Recurring options. "none" = single message; "weekly" / "monthly" repeat.
  const recur = String(formData.get("recur") ?? "none")
  const recurCountRaw = Number(formData.get("recur_count") ?? "1")
  const recurCount = Math.min(
    Math.max(Number.isFinite(recurCountRaw) ? recurCountRaw : 1, 1),
    12
  )

  // Validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_envoi)) {
    return { error: "Date invalide." }
  }
  let heure_envoi: string | undefined
  if (heure_envoi_raw) {
    if (!TIME_RE.test(heure_envoi_raw)) {
      return { error: "Heure invalide (format HH:MM attendu)." }
    }
    heure_envoi = heure_envoi_raw
  }
  if (destinataires.length === 0) {
    return { error: "Sélectionnez au moins un destinataire." }
  }
  if (!message) {
    return { error: "Le message ne peut pas être vide." }
  }
  if (message.length > 1500) {
    return { error: "Message trop long (max 1500 caractères)." }
  }

  // Build the list of dates we need to create.
  const dates: string[] = [date_envoi]
  if (recur === "weekly") {
    for (let i = 1; i < recurCount; i++) dates.push(addDays(date_envoi, i * 7))
  } else if (recur === "monthly") {
    for (let i = 1; i < recurCount; i++) dates.push(addMonths(date_envoi, i))
  }

  const attachment_url = attachment_url_raw || undefined
  const attachment_filename = attachment_filename_raw || undefined

  // One message per (recipient × date). N recipients and M recurrence dates
  // therefore create N×M rows in the sheet.
  const total = destinataires.length * dates.length
  let createdCount = 0
  const cree_le = nowLocalDateTime()
  for (const destinataire of destinataires) {
    for (const d of dates) {
      const id = randomUUID()
      const result = await postMessage({
        id,
        date_envoi: d,
        ...(heure_envoi ? { heure_envoi } : {}),
        destinataire,
        message,
        cree_par: session.username,
        cree_le,
        ...(attachment_url ? { attachment_url } : {}),
        ...(attachment_filename ? { attachment_filename } : {}),
      })
      if (!result.ok) {
        // Stop on first error; report partial success if any.
        if (createdCount === 0) {
          return { error: `Erreur lors de l'enregistrement : ${result.error}` }
        }
        return {
          error: `Enregistré ${createdCount}/${total}, puis erreur : ${result.error}`,
        }
      }
      logAudit({
        username: session.username,
        action: "create_message",
        target: id,
        details: {
          date_envoi: d,
          destinataire,
          ...(heure_envoi ? { heure_envoi } : {}),
          recurring: recur !== "none",
        },
      })
      createdCount++
    }
  }

  revalidatePath("/messages")
  redirect(`/messages?created=${createdCount}`)
}

export type DeleteMessageState = { ok?: boolean; error?: string } | null

export async function deleteMessageAction(
  formData: FormData
): Promise<DeleteMessageState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const id = String(formData.get("id") ?? "").trim()
  if (!id) return { error: "ID manquant." }

  // Permission check.
  if (!isAdminOrAbove(session.role)) {
    const messages = await getMessages()
    const target = messages.find((m) => m.id === id)
    if (!target) return { error: "Message introuvable." }
    if (target.cree_par !== session.username) {
      return {
        error: "Tu ne peux supprimer que les messages que tu as créés.",
      }
    }
  }

  const result = await deleteMessage(id)
  if (!result.ok) {
    return { error: `Erreur : ${result.error}` }
  }

  logAudit({
    username: session.username,
    action: "delete_message",
    target: id,
  })
  revalidatePath("/messages")
  return { ok: true }
}

// ---------- Bulk delete ----------

export type BulkDeleteState = {
  ok?: boolean
  error?: string
  deleted?: number
  failed?: number
} | null

export async function bulkDeleteMessagesAction(
  formData: FormData
): Promise<BulkDeleteState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const idsRaw = String(formData.get("ids") ?? "")
  const ids = idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.length === 0) return { error: "Aucun message sélectionné." }

  // For non-admins, refetch and filter to owned messages only.
  let allowedIds = ids
  if (!isAdminOrAbove(session.role)) {
    const messages = await getMessages()
    const ownedIdSet = new Set(
      messages.filter((m) => m.cree_par === session.username).map((m) => m.id)
    )
    allowedIds = ids.filter((id) => ownedIdSet.has(id))
    if (allowedIds.length === 0) {
      return { error: "Tu ne peux supprimer que les messages que tu as créés." }
    }
  }

  let deleted = 0
  let failed = 0
  for (const id of allowedIds) {
    const r = await deleteMessage(id)
    if (r.ok) {
      deleted++
    } else {
      failed++
    }
  }

  logAudit({
    username: session.username,
    action: "bulk_delete_message",
    details: { requested: ids.length, deleted, failed },
  })
  revalidatePath("/messages")
  return { ok: failed === 0, deleted, failed }
}

// ---------- Message update ----------

export type UpdateMessageState = { ok?: boolean; error?: string } | null

export async function updateMessageAction(
  _prev: UpdateMessageState,
  formData: FormData
): Promise<UpdateMessageState> {
  const session = await getSession()
  if (!session) return { error: "Session expirée." }

  const id = String(formData.get("id") ?? "").trim()
  if (!id) return { error: "ID manquant." }

  const date_envoi = String(formData.get("date_envoi") ?? "")
  const heure_envoi_raw = String(formData.get("heure_envoi") ?? "").trim()
  const destinataire = String(formData.get("destinataire") ?? "")
  const message = String(formData.get("message") ?? "").trim()
  const attachment_url = String(formData.get("attachment_url") ?? "").trim()
  const attachment_filename = String(
    formData.get("attachment_filename") ?? ""
  ).trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_envoi)) {
    return { error: "Date invalide." }
  }
  let heure_envoi: string | undefined
  if (heure_envoi_raw) {
    if (!TIME_RE.test(heure_envoi_raw)) {
      return { error: "Heure invalide (HH:MM)." }
    }
    heure_envoi = heure_envoi_raw
  }
  if (!destinataire) return { error: "Sélectionnez un destinataire." }
  if (!message) return { error: "Le message ne peut pas être vide." }
  if (message.length > 1500) {
    return { error: "Message trop long (max 1500 caractères)." }
  }

  // Re-fetch the target to enforce permissions and prevent editing sent messages.
  const messages = await getMessages()
  const target = messages.find((m) => m.id === id)
  if (!target) return { error: "Message introuvable." }
  if (target.envoye) {
    return { error: "Ce message a déjà été envoyé, il ne peut plus être modifié." }
  }
  if (
    !isAdminOrAbove(session.role) &&
    target.cree_par !== session.username
  ) {
    return {
      error: "Tu ne peux modifier que les messages que tu as créés.",
    }
  }

  // Always send attachment_url + attachment_filename so the user can clear
  // them — empty string means "remove the attachment".
  const result = await putMessage(id, {
    date_envoi,
    ...(heure_envoi ? { heure_envoi } : {}),
    destinataire,
    message,
    attachment_url,
    attachment_filename,
  })
  if (!result.ok) {
    return { error: `Erreur : ${result.error}` }
  }

  logAudit({
    username: session.username,
    action: "update_message",
    target: id,
    details: {
      date_envoi,
      destinataire,
      ...(heure_envoi ? { heure_envoi } : {}),
    },
  })
  revalidatePath("/messages")
  return { ok: true }
}
