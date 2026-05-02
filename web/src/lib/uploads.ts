// Upload directory + media-type helpers.
//
// Files live in <data>/uploads/<uuid>.<ext>. The data dir mirrors where the
// SQLite DB lives, so the existing Docker volume already persists them.

import { dirname, resolve } from "node:path"

export const MAX_UPLOAD_BYTES = 16 * 1024 * 1024 // 16 MB — WhatsApp limit for media

// MIME → extension. Includes aliases (Windows sometimes sends "image/jpg",
// legacy IE sends "image/pjpeg", iPhones send "image/heic", etc.).
export const ALLOWED_TYPES: Record<string, string> = {
  // Images
  "image/jpeg": "jpg",
  "image/jpg": "jpg",       // alias non-standard — Windows / Edge l'envoient
  "image/pjpeg": "jpg",     // alias legacy
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",     // iPhone par défaut
  "image/heif": "heif",
  // Documents
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  // Audio
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  // Video
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
}

// Fallback : si le browser envoie une MIME générique (`application/octet-
// stream`) ou inconnue, on accepte aussi sur la base de l'extension. Note :
// l'extension `jpeg` est canoniquement renommée en `jpg`.
const EXT_TO_CANONICAL: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  heic: "heic",
  heif: "heif",
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  xls: "xls",
  xlsx: "xlsx",
  mp3: "mp3",
  ogg: "ogg",
  m4a: "m4a",
  mp4: "mp4",
  "3gp": "3gp",
}

/**
 * Détermine l'extension à utiliser pour un upload. Retourne `null` si le
 * fichier est rejeté (ni MIME ni extension reconnus).
 */
export function resolveUploadExt(opts: {
  mime: string
  filename: string
}): string | null {
  const ext = ALLOWED_TYPES[opts.mime]
  if (ext) return ext
  const fileExt = opts.filename.split(".").pop()?.toLowerCase()
  if (!fileExt) return null
  return EXT_TO_CANONICAL[fileExt] ?? null
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  "3gp": "video/3gpp",
}

/** Pour servir le fichier avec le bon Content-Type côté GET /api/files/<name>. */
export function extToMime(ext: string | undefined): string | null {
  if (!ext) return null
  return EXT_TO_MIME[ext.toLowerCase()] ?? null
}

// /*turbopackIgnore: true*/ on every dynamic path call so Turbopack doesn't
// pessimistically bundle the whole project into the route handler.
export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim().length > 0) {
    return resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR)
  }
  // Co-locate next to the SQLite DB so the same persistent volume covers both.
  if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim().length > 0) {
    return resolve(
      /*turbopackIgnore: true*/ dirname(process.env.DATABASE_PATH),
      "uploads"
    )
  }
  return resolve(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads")
}

/** Filenames are <uuid>.<ext>. Reject anything else (defends against path traversal). */
export function isSafeFilename(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && !name.includes("..")
}
