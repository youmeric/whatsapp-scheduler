// Upload endpoint — stores a file under <data>/uploads and returns a public
// URL pointing at /api/files/<filename>.
//
// Auth: requires a valid session cookie (only logged-in users can upload).

import type { NextRequest } from "next/server"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

import { isCookieValid } from "@/lib/auth"
import {
  ALLOWED_TYPES,
  MAX_UPLOAD_BYTES,
  getUploadsDir,
} from "@/lib/uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("wa_session")?.value
  if (!isCookieValid(cookie)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Aucun fichier fourni" }, { status: 400 })
  }
  if (file.size === 0) {
    return Response.json({ error: "Fichier vide" }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `Fichier trop volumineux (max ${MAX_UPLOAD_BYTES / 1024 / 1024} Mo)` },
      { status: 413 }
    )
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return Response.json(
      { error: `Type de fichier non autorisé : ${file.type}` },
      { status: 400 }
    )
  }

  const dir = getUploadsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const safeName = `${randomUUID()}.${ext}`
  const path = join(dir, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path, buffer)

  // Build a full URL so n8n / the bot can fetch it without knowing our host.
  const origin = request.nextUrl.origin
  const url = `${origin}/api/files/${safeName}`

  return Response.json({
    ok: true,
    filename: safeName,
    original_name: file.name,
    url,
    size: file.size,
    type: file.type,
  })
}
