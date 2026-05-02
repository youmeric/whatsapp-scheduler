"use client"

import { useRef, useState } from "react"
import {
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

const ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.mp3,.ogg,.m4a,.mp4,.3gp,image/*,application/pdf,audio/*,video/*"

const MAX_BYTES = 16 * 1024 * 1024

export type AttachmentValue = {
  url: string
  filename: string // display name (original)
} | null

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

function iconFor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    return <ImageIcon className="size-4 text-muted-foreground" />
  if (["mp4", "3gp", "mov", "avi"].includes(ext))
    return <FileVideo className="size-4 text-muted-foreground" />
  if (["mp3", "ogg", "m4a", "wav"].includes(ext))
    return <FileAudio className="size-4 text-muted-foreground" />
  return <FileText className="size-4 text-muted-foreground" />
}

export function AttachmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: AttachmentValue
  onChange: (next: AttachmentValue) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function onFileChosen(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo)`)
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/uploads", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? `Upload échoué (${res.status})`)
        return
      }
      onChange({ url: data.url, filename: data.original_name ?? file.name })
      toast.success("Pièce jointe ajoutée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload échoué")
    } finally {
      setUploading(false)
      // Reset the input so picking the same file twice still triggers onChange.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFileChosen(f)
        }}
        disabled={disabled || uploading}
      />

      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
          {iconFor(value.filename)}
          <a
            href={value.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm truncate hover:underline"
            title={value.filename}
          >
            {value.filename}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => onChange(null)}
            disabled={disabled || uploading}
            aria-label="Retirer la pièce jointe"
            title="Retirer"
          >
            <X />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Paperclip />
          )}
          {uploading ? "Upload en cours…" : "Joindre un fichier"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Formats : image, PDF, audio, vidéo, document Office. Max 16 Mo.
      </p>
    </div>
  )
}
