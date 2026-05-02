// In-memory pub/sub for Server-Sent Events.
// Used by /api/events (subscribers) and /api/notify (publishers from n8n).
// This works only within a single Node process — fine for a single-container
// Next.js standalone deployment, not for multi-replica setups.

type Listener = (chunk: Uint8Array) => void

// Use globalThis to survive HMR (Hot Module Replacement) in dev — otherwise
// each rebuild creates a fresh Set and existing client connections get orphaned.
declare global {
  // eslint-disable-next-line no-var
  var __sseListeners: Set<Listener> | undefined
}

const listeners = (globalThis.__sseListeners ??= new Set<Listener>())

export type SseEvent =
  | { type: "message_sent"; id: string; destinataire: string; date_envoi: string }
  | { type: "ping"; t: number }

export function subscribe(cb: Listener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function broadcast(event: SseEvent): void {
  const encoder = new TextEncoder()
  const chunk = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
  for (const cb of listeners) {
    try {
      cb(chunk)
    } catch {
      // Ignore broken pipes; the cleanup runs on connection abort anyway.
    }
  }
}

export function listenerCount(): number {
  return listeners.size
}
