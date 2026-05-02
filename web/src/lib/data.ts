// Data access layer.
// If N8N_WEBHOOK_BASE is set, calls the n8n webhooks documented in /N8N_WEBHOOKS.md.
// Otherwise falls back to the in-memory mocks below — useful for frontend-only dev.

import type { Recipient, ScheduledMessage } from "./types"

// ---------- mocks (used when N8N_WEBHOOK_BASE is not set) ----------

const MOCK_RECIPIENTS: Recipient[] = [
  { nom: "Marie Dupont", numero: "+33612345678" },
  { nom: "Jean Martin", numero: "+33687654321" },
  { nom: "Sophie Bernard", numero: "+33611223344" },
  { nom: "Lucas Petit", numero: "+33655667788" },
  { nom: "Camille Roux", numero: "+33699887766" },
]

const MOCK_MESSAGES: ScheduledMessage[] = [
  {
    id: "1",
    date_envoi: "2026-05-02",
    destinataire: "Marie Dupont",
    message: "Bonjour Marie, n'oublie pas notre rendez-vous demain à 14h !",
    envoye: false,
    cree_par: "simon",
    cree_le: "2026-04-29T15:30:00Z",
  },
  {
    id: "2",
    date_envoi: "2026-05-05",
    destinataire: "Jean Martin",
    message: "Salut Jean, joyeux anniversaire 🎉",
    envoye: false,
    cree_par: "simon",
    cree_le: "2026-04-28T09:12:00Z",
  },
  {
    id: "3",
    date_envoi: "2026-04-28",
    destinataire: "Sophie Bernard",
    message: "Coucou Sophie, juste un petit message pour prendre des nouvelles.",
    envoye: true,
    cree_par: "simon",
    cree_le: "2026-04-25T18:00:00Z",
  },
  {
    id: "4",
    date_envoi: "2026-05-10",
    destinataire: "Lucas Petit",
    message: "Lucas, on se voit toujours samedi ?",
    envoye: false,
    cree_par: "simon",
    cree_le: "2026-04-30T08:00:00Z",
  },
]

// ---------- helpers ----------

function getBase(): string | null {
  const base = process.env.N8N_WEBHOOK_BASE?.trim()
  return base && base.length > 0 ? base.replace(/\/+$/, "") : null
}

function authHeaders(): HeadersInit {
  const key = process.env.N8N_API_KEY
  return key ? { "X-API-Key": key } : {}
}

function normalizeMessage(raw: unknown): ScheduledMessage | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (!r.id || !r.date_envoi || !r.destinataire) return null
  const rawHeure = r.heure_envoi
  const heure_envoi =
    typeof rawHeure === "string" && /^\d{2}:\d{2}$/.test(rawHeure.trim())
      ? rawHeure.trim()
      : undefined
  const rawAttUrl = r.attachment_url
  const attachment_url =
    typeof rawAttUrl === "string" && rawAttUrl.trim().length > 0
      ? rawAttUrl.trim()
      : undefined
  const rawAttName = r.attachment_filename
  const attachment_filename =
    typeof rawAttName === "string" && rawAttName.trim().length > 0
      ? rawAttName.trim()
      : undefined
  return {
    id: String(r.id),
    date_envoi: String(r.date_envoi),
    heure_envoi,
    destinataire: String(r.destinataire),
    message: String(r.message ?? ""),
    envoye:
      r.envoye === true ||
      r.envoye === "TRUE" ||
      r.envoye === "true" ||
      r.envoye === 1 ||
      r.envoye === "1",
    cree_par: String(r.cree_par ?? ""),
    cree_le: String(r.cree_le ?? ""),
    attachment_url,
    attachment_filename,
  }
}

function normalizeRecipient(raw: unknown): Recipient | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (!r.nom || !r.numero) return null
  return { nom: String(r.nom), numero: String(r.numero) }
}

// ---------- public API ----------

export async function getMessages(): Promise<ScheduledMessage[]> {
  const base = getBase()
  if (!base) return MOCK_MESSAGES

  const res = await fetch(`${base}/messages`, {
    headers: authHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`n8n GET /messages failed: ${res.status}`)
  }
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new Error("n8n GET /messages: array expected")
  return data
    .map(normalizeMessage)
    .filter((m): m is ScheduledMessage => m !== null)
}

export async function getRecipients(): Promise<Recipient[]> {
  const base = getBase()
  if (!base) return MOCK_RECIPIENTS

  const res = await fetch(`${base}/recipients`, {
    headers: authHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`n8n GET /recipients failed: ${res.status}`)
  }
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new Error("n8n GET /recipients: array expected")
  return data
    .map(normalizeRecipient)
    .filter((r): r is Recipient => r !== null)
}

export async function postRecipient(
  r: Recipient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getBase()
  if (!base) {
    console.log("[mock] would POST /recipients:", r)
    return { ok: true }
  }
  try {
    const res = await fetch(`${base}/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(r),
    })
    if (!res.ok) {
      return { ok: false, error: `n8n POST /recipients failed: ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

export async function deleteRecipient(
  nom: string,
  numero: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getBase()
  if (!base) {
    console.log("[mock] would DELETE /recipients:", { nom, numero })
    return { ok: true }
  }
  try {
    const params = new URLSearchParams({ nom, numero })
    const res = await fetch(`${base}/recipients?${params.toString()}`, {
      method: "DELETE",
      headers: authHeaders(),
    })
    if (!res.ok) {
      return {
        ok: false,
        error: `n8n DELETE /recipients failed: ${res.status}`,
      }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

export async function putMessage(
  id: string,
  partial: Partial<
    Pick<
      ScheduledMessage,
      | "date_envoi"
      | "heure_envoi"
      | "destinataire"
      | "message"
      | "attachment_url"
      | "attachment_filename"
    >
  >
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getBase()
  const payload = { id, ...partial }
  if (!base) {
    console.log("[mock] would PUT /messages:", payload)
    return { ok: true }
  }
  try {
    const res = await fetch(`${base}/messages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { ok: false, error: `n8n PUT /messages failed: ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

export async function deleteMessage(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getBase()
  if (!base) {
    console.log("[mock] would DELETE /messages:", id)
    return { ok: true }
  }
  try {
    const res = await fetch(
      `${base}/messages?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      }
    )
    if (!res.ok) {
      return { ok: false, error: `n8n DELETE /messages failed: ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

export async function postMessage(
  msg: Omit<ScheduledMessage, "envoye"> & { envoye?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getBase()
  const payload = { ...msg, envoye: msg.envoye ?? false }

  if (!base) {
    // No backend configured — log and pretend success so frontend dev still works.
    console.log("[mock] would POST /messages:", payload)
    return { ok: true }
  }

  try {
    const res = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { ok: false, error: `n8n POST /messages failed: ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
