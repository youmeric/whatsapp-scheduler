// Accusé de réception WhatsApp — le bot appelle cet endpoint depuis onAck
// (wppconnect) pour chaque changement d'état d'un message envoyé.
//
// Auth : header X-API-Key = N8N_API_KEY (comme /api/notify).
// Payload : { id: string, ack: number }
//   ack : 1 = envoyé (✓), 2 = reçu (✓✓), 3 = lu (✓✓ bleu), 4 = écouté
//
// `id` est NOTRE identifiant de message (celui de la feuille), que le bot doit
// mémoriser au moment de l'envoi (voir doc bot).

import type { NextRequest } from "next/server"
import { setMessageAck } from "@/lib/db"
import { broadcast } from "@/lib/sse-bus"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const expected = process.env.N8N_API_KEY
  if (!expected) {
    return Response.json(
      { ok: false, error: "Server not configured" },
      { status: 500 }
    )
  }
  if (request.headers.get("x-api-key") !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }
  const r = (body ?? {}) as Record<string, unknown>
  const id = typeof r.id === "string" ? r.id.trim() : ""
  const ack = Number(r.ack)
  if (!id || !Number.isFinite(ack)) {
    return Response.json(
      { ok: false, error: "Missing id or ack" },
      { status: 400 }
    )
  }

  setMessageAck(id, ack)
  // Notifie les onglets ouverts pour rafraîchir l'affichage.
  broadcast({ type: "ack", id, ack })
  return Response.json({ ok: true })
}
