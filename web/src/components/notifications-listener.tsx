"use client"

// Listens to /api/events (Server-Sent Events) and shows a toast every time
// n8n notifies the site that a scheduled message has been sent.
// Mounted once in the (app) layout.

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type SseEvent =
  | { type: "message_sent"; id: string; destinataire: string; date_envoi: string }
  | { type: "ping"; t: number }

export function NotificationsListener() {
  const router = useRouter()
  // Avoid re-creating the EventSource on each rerender.
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (sourceRef.current) return
    const es = new EventSource("/api/events")
    sourceRef.current = es

    es.onmessage = (e) => {
      let data: SseEvent
      try {
        data = JSON.parse(e.data) as SseEvent
      } catch {
        return
      }
      if (data.type === "message_sent") {
        toast.success(`Message envoyé à ${data.destinataire}`, {
          description: `Date prévue : ${data.date_envoi}`,
        })
        // Refresh the messages list so the row flips from "à venir" to "envoyé".
        router.refresh()
      }
    }

    es.onerror = () => {
      // Browser will reconnect automatically with backoff.
    }

    return () => {
      es.close()
      sourceRef.current = null
    }
  }, [router])

  return null
}
