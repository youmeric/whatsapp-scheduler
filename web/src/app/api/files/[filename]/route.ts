// Serves a previously-uploaded file from <data>/uploads.
//
// Auth: cookie session (browser previews) OR X-API-Key (n8n/bot fetch).
// Both browsers and n8n need to reach this endpoint, hence the dual auth.

import type { NextRequest } from "next/server"
import { stat } from "node:fs/promises"
import { createReadStream } from "node:fs"
import { join } from "node:path"
import { Readable } from "node:stream"

import { isCookieValid } from "@/lib/auth"
import { extToMime, getUploadsDir, isSafeFilename } from "@/lib/uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  // Auth: cookie OR X-API-Key.
  const cookie = request.cookies.get("wa_session")?.value
  const apiKey = request.headers.get("x-api-key")
  const expectedKey = process.env.N8N_API_KEY
  const apiKeyOk =
    !!expectedKey && !!apiKey && apiKey === expectedKey
  if (!isCookieValid(cookie) && !apiKeyOk) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { filename } = await params
  if (!isSafeFilename(filename)) {
    return new Response("Invalid filename", { status: 400 })
  }

  const path = join(getUploadsDir(), filename)
  let stats
  try {
    stats = await stat(path)
  } catch {
    return new Response("Not found", { status: 404 })
  }
  if (!stats.isFile()) {
    return new Response("Not found", { status: 404 })
  }

  const ext = filename.split(".").pop()
  const mime = extToMime(ext) ?? "application/octet-stream"

  // Stream the file rather than loading into memory — handles 16MB media well.
  const nodeStream = createReadStream(path)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

  return new Response(webStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stats.size),
      "Cache-Control": "private, max-age=3600",
      // Inline so images / PDFs preview in browser; the original filename
      // is preserved when the user clicks "save as".
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  })
}
