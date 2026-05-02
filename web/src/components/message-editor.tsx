"use client"

import dynamic from "next/dynamic"
import { useRef, useState } from "react"
import {
  Bold,
  Code2,
  Eye,
  Italic,
  Pencil,
  Quote,
  Smile,
  Strikethrough,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { WhatsappPreview } from "@/components/whatsapp-preview"
import { cn } from "@/lib/utils"

// Heavy lib — load only client-side and only when needed.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-[300px] h-[400px] text-sm text-muted-foreground">
      Chargement…
    </div>
  ),
})

type WhatsappFormat = "bold" | "italic" | "strike" | "mono"

const MARKERS: Record<WhatsappFormat, [string, string]> = {
  bold: ["*", "*"],
  italic: ["_", "_"],
  strike: ["~", "~"],
  mono: ["```", "```"],
}

export function MessageEditor({
  id,
  name,
  value,
  onChange,
  placeholder,
  rows = 6,
  required,
  disabled,
}: {
  id?: string
  name?: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
  disabled?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<"edit" | "preview">("edit")

  function applyFormat(fmt: WhatsappFormat) {
    const el = ref.current
    if (!el) return
    const [left, right] = MARKERS[fmt]
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const before = value.slice(0, start)
    const selected = value.slice(start, end)
    const after = value.slice(end)
    const next = `${before}${left}${selected}${right}${after}`
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const innerStart = start + left.length
      const innerEnd = innerStart + selected.length
      el.setSelectionRange(innerStart, innerEnd)
    })
  }

  function toggleLinePrefix(prefix: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const endIdx = end > start ? end - 1 : end
    const nextNewline = value.indexOf("\n", endIdx)
    const lineEnd = nextNewline === -1 ? value.length : nextNewline

    const before = value.slice(0, lineStart)
    const block = value.slice(lineStart, lineEnd)
    const after = value.slice(lineEnd)

    const lines = block.split("\n")
    const allHavePrefix = lines.every((l) => l.startsWith(prefix))
    const transformed = allHavePrefix
      ? lines.map((l) => l.slice(prefix.length)).join("\n")
      : lines.map((l) => prefix + l).join("\n")

    const next = before + transformed + after
    onChange(next)

    requestAnimationFrame(() => {
      el.focus()
      const delta = transformed.length - block.length
      const newStart = allHavePrefix
        ? Math.max(lineStart, start - prefix.length)
        : start + prefix.length
      const newEnd = end + delta
      el.setSelectionRange(newStart, newEnd)
    })
  }

  function insertAtCursor(text: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    })
  }

  const toolbarDisabled = tab === "preview"

  return (
    <div className="rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-colors">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-1">
        <ToolbarButton
          label="Gras (*texte*)"
          onClick={() => applyFormat("bold")}
          disabled={toolbarDisabled}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Italique (_texte_)"
          onClick={() => applyFormat("italic")}
          disabled={toolbarDisabled}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Barré (~texte~)"
          onClick={() => applyFormat("strike")}
          disabled={toolbarDisabled}
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          label="Code (```texte```)"
          onClick={() => applyFormat("mono")}
          disabled={toolbarDisabled}
        >
          <Code2 />
        </ToolbarButton>
        <ToolbarButton
          label="Citation (> texte au début de ligne)"
          onClick={() => toggleLinePrefix("> ")}
          disabled={toolbarDisabled}
        >
          <Quote />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" aria-hidden />

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Insérer un emoji"
                title="Insérer un emoji"
                disabled={toolbarDisabled}
              >
                <Smile />
              </Button>
            }
          />
          <PopoverContent
            className="p-0 w-auto"
            align="start"
            sideOffset={6}
          >
            <EmojiPicker
              lazyLoadEmojis
              onEmojiClick={(e) => insertAtCursor(e.emoji)}
              skinTonesDisabled
              searchPlaceHolder="Rechercher un emoji…"
              previewConfig={{ showPreview: false }}
              width={320}
              height={380}
            />
          </PopoverContent>
        </Popover>

        {/* Edit / Preview toggle */}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant={tab === "edit" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("edit")}
            className="h-7 gap-1.5"
            aria-pressed={tab === "edit"}
          >
            <Pencil className="size-3.5" />
            Éditer
          </Button>
          <Button
            type="button"
            variant={tab === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("preview")}
            className="h-7 gap-1.5"
            aria-pressed={tab === "preview"}
          >
            <Eye className="size-3.5" />
            Aperçu
          </Button>
        </div>
      </div>

      {tab === "edit" ? (
        <Textarea
          id={id}
          name={name}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={cn(
            "border-0 bg-transparent rounded-t-none focus-visible:ring-0 focus-visible:border-0 shadow-none"
          )}
        />
      ) : (
        <div className="p-3">
          <WhatsappPreview value={value} />
          {/* Hidden mirror so the form still submits the message field even
              when the user clicks "Aperçu" right before submit. */}
          {name ? <input type="hidden" name={name} value={value} /> : null}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground"
    >
      {children}
    </Button>
  )
}
