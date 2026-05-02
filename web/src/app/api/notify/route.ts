// Notification webhook — n8n calls this when a scheduled message has been
// sent successfully. The site then pushes the event to all connected SSE
// clients so admins/users see a live toast.
//
// Auth: requires X-API-Key header matching N8N_API_KEY (same secret as the
// rest of the n8n integration).
//
// Expected payload:
//   { id: string, destinataire: string, date_envoi: string }

import type { NextRequest } from "next/server"
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
  const provided = request.headers.get("x-api-key")
  if (provided !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    )
  }

  if (!body || typeof body !== "object") {
    return Response.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 }
    )
  }
  const r = body as Record<string, unknown>
  const id = typeof r.id === "string" ? r.id : ""
  const destinataire =
    typeof r.destinataire === "string" ? r.destinataire : ""
  const date_envoi =
    typeof r.date_envoi === "string" ? r.date_envoi : ""
  if (!id || !destinataire) {
    return Response.json(
      { ok: false, error: "Missing id or destinataire" },
      { status: 400 }
    )
  }

  broadcast({
    type: "message_sent",
    id,
    destinataire,
    date_envoi,
  })
  return Response.json({ ok: true })
}
