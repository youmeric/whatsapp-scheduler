// Server-Sent Events stream — clients connect once and receive a real-time
// stream of events (currently: when n8n marks a message as sent).
//
// Auth: requires a valid session cookie.

import type { NextRequest } from "next/server"
import { isCookieValid } from "@/lib/auth"
import { broadcast, subscribe } from "@/lib/sse-bus"

// Stream connections must run on the Node runtime (not edge) so we can hold
// the connection open and run our in-memory pub/sub.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("wa_session")?.value
  if (!isCookieValid(cookie)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Initial hello so the client knows the channel is live.
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "ping", t: Date.now() })}\n\n`
        )
      )

      // Subscribe to the bus.
      const unsubscribe = subscribe((chunk) => {
        try {
          controller.enqueue(chunk)
        } catch {
          // Stream already closed.
        }
      })

      // Keep-alive ping every 25s — proxies (nginx, Cloudflare) often kill
      // idle connections at 30–60s.
      const pingInterval = setInterval(() => {
        broadcast({ type: "ping", t: Date.now() })
      }, 25_000)

      // Cleanup on disconnect.
      const cleanup = () => {
        clearInterval(pingInterval)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* ignore */
        }
      }
      request.signal.addEventListener("abort", cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
