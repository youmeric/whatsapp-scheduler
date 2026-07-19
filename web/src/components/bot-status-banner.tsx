"use client"

import { useEffect, useState } from "react"
import { TriangleAlert } from "lucide-react"

type Status = "unknown" | "ok" | "down"

/**
 * Polls /api/bot-health and shows a warning banner when the wppconnect bot is
 * unreachable/not ready. Silent when the feature is disabled (no
 * BOT_HEALTH_URL) or on transient network errors, to avoid false alarms.
 */
export function BotStatusBanner() {
  const [status, setStatus] = useState<Status>("unknown")

  useEffect(() => {
    let active = true

    async function check() {
      try {
        const res = await fetch("/api/bot-health", { cache: "no-store" })
        const data = (await res.json()) as {
          configured?: boolean
          ready?: boolean
        }
        if (!active) return
        if (!data.configured) setStatus("ok") // feature off → no banner
        else setStatus(data.ready ? "ok" : "down")
      } catch {
        // Don't nag on a transient fetch error.
        if (active) setStatus("ok")
      }
    }

    check()
    const id = setInterval(check, 60_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  if (status !== "down") return null

  return (
    <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      <TriangleAlert className="size-4 shrink-0" />
      <span>
        Le bot WhatsApp semble déconnecté — les messages programmés risquent de
        ne pas partir. Vérifie la session du bot (QR à re-scanner ?).
      </span>
    </div>
  )
}
