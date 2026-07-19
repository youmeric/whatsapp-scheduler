// Proxies the wppconnect bot's /health so the browser can show a warning
// banner when the bot is disconnected (scheduled messages would silently
// fail otherwise).
//
// Opt-in: set BOT_HEALTH_URL to the bot's health endpoint (e.g.
// http://bot-host:3000/health). If unset, the feature is disabled and the
// banner never shows.
//
// Only reachable by logged-in users (proxy gates /api/bot-health, and we
// re-check the session here as defense in depth).

import { getSession } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return Response.json({ configured: false, ready: false }, { status: 401 })
  }

  const url = process.env.BOT_HEALTH_URL?.trim()
  if (!url) {
    // Feature not configured → treat as "nothing to report".
    return Response.json({ configured: false, ready: false })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) {
      return Response.json({ configured: true, ready: false })
    }
    const data = (await res.json().catch(() => null)) as
      | { ready?: unknown }
      | null
    const ready = !!(data && data.ready === true)
    return Response.json({ configured: true, ready })
  } catch {
    // Timeout / connection refused → bot unreachable.
    return Response.json({ configured: true, ready: false })
  } finally {
    clearTimeout(timeout)
  }
}
