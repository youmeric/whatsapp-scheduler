// Upload directory + media-type helpers.
//
// Files live in <data>/uploads/<uuid>.<ext>. The data dir mirrors where the
// SQLite DB lives, so the existing Docker volume already persists them.

import { dirname, resolve } from "node:path"

export const MAX_UPLOAD_BYTES = 16 * 1024 * 1024 // 16 MB — WhatsApp limit for media

// Map of accepted MIME types → file extension. Anything not in this list is
// rejected at upload time.
export const ALLOWED_TYPES: Record<string, string> = {
  // Images
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  // Documents
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  // Audio
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  // Video
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
}

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_TYPES).map(([m, e]) => [e, m])
)

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
