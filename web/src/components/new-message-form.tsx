"use client"

import { useActionState, useMemo, useState, useTransition } from "react"
import {
  CalendarIcon,
  Check,
  ChevronDownIcon,
  FileText,
  Paperclip,
  Repeat,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageEditor } from "@/components/message-editor"
import {
  AttachmentPicker,
  type AttachmentValue,
} from "@/components/attachment-picker"
import { cn } from "@/lib/utils"
import { digitsOnly, toWhatsappAddress } from "@/lib/phone"
import type { Recipient, Template } from "@/lib/types"
import {
  createMessageAction,
  type CreateMessageState,
} from "@/app/(app)/messages/actions"

const MAX_LEN = 1500

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

function toIsoDate(d: Date): string {
  // Use local-date components so the chosen day matches what the user sees.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Hours from 06:00 to 22:00 (every full hour) — covers reasonable send windows.
const HOURS: string[] = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6
  return `${String(h).padStart(2, "0")}:00`
})

type RecurOption = "none" | "weekly" | "monthly"

// Value → label maps so base-ui's <SelectValue> shows the label (not the raw
// value like "none") in the trigger when the popup is closed.
const RECUR_ITEMS: Record<string, string> = {
  none: "Pas de répétition",
  weekly: "Toutes les semaines",
  monthly: "Tous les mois",
}
const RECUR_COUNTS = [2, 3, 4, 5, 6, 8, 10, 12]
const RECUR_COUNT_ITEMS: Record<string, string> = Object.fromEntries(
  RECUR_COUNTS.map((n) => [String(n), `${n} occurrences`])
)

export function NewMessageForm({
  recipients,
  templates = [],
  initialMessage,
  initialDestinataires,
  initialHeure,
}: {
  recipients: Recipient[]
  templates?: Template[]
  /** Optional prefill (used when duplicating an existing message). */
  initialMessage?: string
  initialDestinataires?: string[]
  initialHeure?: string
}) {
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [heure, setHeure] = useState<string>(initialHeure ?? "10:00")
  const [destinataires, setDestinataires] = useState<string[]>(
    initialDestinataires ?? []
  )
  const [message, setMessage] = useState<string>(initialMessage ?? "")
  const [recur, setRecur] = useState<RecurOption>("none")
  const [recurCount, setRecurCount] = useState<string>("4")
  const [templateId, setTemplateId] = useState<string>("")
  const [attachment, setAttachment] = useState<AttachmentValue>(null)
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState<CreateMessageState, FormData>(
    async (prev, fd) => {
      const next = await createMessageAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      }
      return next
    },
    null
  )

  const today = startOfToday()
  const charsLeft = MAX_LEN - message.length
  const canSubmit =
    !!date &&
    destinataires.length > 0 &&
    message.trim().length > 0 &&
    charsLeft >= 0

  // Total rows created = recipients × recurrence occurrences.
  const occurrences = recur === "none" ? 1 : Number(recurCount)
  const totalMessages = destinataires.length * occurrences

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.nom.localeCompare(b.nom)),
    [templates]
  )
  const templateItems = useMemo(
    () =>
      Object.fromEntries(
        sortedTemplates.map((t) => [String(t.id), t.nom])
      ) as Record<string, string>,
    [sortedTemplates]
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    const fd = new FormData(e.currentTarget)
    startTransition(() => formAction(fd))
  }

  function applyTemplate(id: string) {
    setTemplateId(id)
    if (!id) return
    const tpl = sortedTemplates.find((t) => String(t.id) === id)
    if (!tpl) return
    if (
      message.trim().length > 0 &&
      !confirm("Remplacer le message en cours par ce modèle ?")
    ) {
      return
    }
    setMessage(tpl.contenu)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5 pt-6">
          {/* hidden inputs that mirror controlled state */}
          <input
            type="hidden"
            name="date_envoi"
            value={date ? toIsoDate(date) : ""}
          />
          <input type="hidden" name="heure_envoi" value={heure} />
          <input
            type="hidden"
            name="destinataires"
            value={destinataires.join(",")}
          />
          <input type="hidden" name="recur" value={recur} />
          <input type="hidden" name="recur_count" value={recurCount} />
          <input
            type="hidden"
            name="attachment_url"
            value={attachment?.url ?? ""}
          />
          <input
            type="hidden"
            name="attachment_filename"
            value={attachment?.filename ?? ""}
          />

          {/* Template picker — only if there are templates */}
          {sortedTemplates.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                Modèle (optionnel)
              </Label>
              <Select
                items={templateItems}
                value={templateId}
                onValueChange={(v) => applyTemplate(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pré-remplir avec un modèle…" />
                </SelectTrigger>
                <SelectContent>
                  {sortedTemplates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className="flex flex-col">
                        <span>{t.nom}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {t.contenu.slice(0, 80)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div className="space-y-2">
              <Label>Date d&apos;envoi</Label>
              <Popover>
                <PopoverTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      type="button"
                      variant="outline"
                      size="lg"
                      className={cn(
                        "w-full justify-start font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon />
                      {date
                        ? dateFormatter.format(date)
                        : "Choisir une date"}
                    </Button>
                  )}
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < today}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Heure</Label>
              <Select value={heure} onValueChange={(v) => setHeure(v ?? "10:00")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-3">
            Envoi automatique ce jour-là à l&apos;heure choisie. Par défaut 10h
            (l&apos;heure n&apos;est prise en compte que si la colonne{" "}
            <code className="font-mono">heure_envoi</code> existe dans le
            Google Sheet et que le workflow n8n la lit).
          </p>

          <div className="space-y-2">
            <Label>Destinataire{destinataires.length > 1 ? "s" : ""}</Label>
            <RecipientMultiSelect
              recipients={recipients}
              selected={destinataires}
              onChange={setDestinataires}
            />
            {destinataires.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Le message sera programmé pour {destinataires.length}{" "}
                destinataires.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  charsLeft < 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {charsLeft} caractère{Math.abs(charsLeft) > 1 ? "s" : ""}
              </span>
            </div>
            <MessageEditor
              id="message"
              name="message"
              value={message}
              onChange={setMessage}
              rows={6}
              placeholder="Bonjour, …"
              required
            />
            <p className="text-xs text-muted-foreground">
              Formats WhatsApp pris en charge :{" "}
              <code className="font-mono">*gras*</code>,{" "}
              <code className="font-mono">_italique_</code>,{" "}
              <code className="font-mono">~barré~</code>,{" "}
              <code className="font-mono">```code```</code>,{" "}
              <code className="font-mono">{"> citation"}</code>.
            </p>
          </div>

          {/* Attachment */}
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="size-3.5 text-muted-foreground" />
              Pièce jointe (optionnel)
            </Label>
            <AttachmentPicker value={attachment} onChange={setAttachment} />
          </div>

          {/* Recurrence */}
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <Label className="flex items-center gap-1.5">
              <Repeat className="size-3.5 text-muted-foreground" />
              Répétition
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
              <Select
                items={RECUR_ITEMS}
                value={recur}
                onValueChange={(v) => setRecur((v ?? "none") as RecurOption)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pas de répétition</SelectItem>
                  <SelectItem value="weekly">Toutes les semaines</SelectItem>
                  <SelectItem value="monthly">Tous les mois</SelectItem>
                </SelectContent>
              </Select>
              {recur !== "none" && (
                <Select
                  items={RECUR_COUNT_ITEMS}
                  value={recurCount}
                  onValueChange={(v) => setRecurCount(v ?? "4")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECUR_COUNTS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} occurrences
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {recur !== "none" && (
              <p className="text-xs text-muted-foreground">
                {recurCount} envois {recur === "weekly"
                  ? "espacés de 7 jours"
                  : "mensuels"}{" "}
                à partir de la date choisie
                {destinataires.length > 1
                  ? `, pour chacun des ${destinataires.length} destinataires (${totalMessages} messages au total)`
                  : ""}
                .
              </p>
            )}
          </div>

          {state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </CardContent>

        <CardFooter className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit || isPending}
          >
            {isPending
              ? "Enregistrement…"
              : totalMessages <= 1
                ? "Programmer le message"
                : `Programmer ${totalMessages} messages`}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

type RecipientOption = {
  address: string
  nom: string
  digits: string
}

/**
 * Multi-select for recipients: a popover with a search box and a checkbox
 * list. Selected values are the wppconnect chat-ids ("<digits>@c.us").
 */
function RecipientMultiSelect({
  recipients,
  selected,
  onChange,
}: {
  recipients: Recipient[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const options = useMemo<RecipientOption[]>(
    () =>
      recipients
        .map((r) => ({
          address: toWhatsappAddress(r.numero),
          nom: r.nom,
          digits: digitsOnly(r.numero),
        }))
        .filter((o) => o.address),
    [recipients]
  )

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const qDigits = query.replace(/\D/g, "")
    if (!q) return options
    return options.filter(
      (o) =>
        o.nom.toLowerCase().includes(q) ||
        (qDigits.length > 0 && o.digits.includes(qDigits))
    )
  }, [options, query])

  const selectedNames = useMemo(
    () =>
      options.filter((o) => selectedSet.has(o.address)).map((o) => o.nom),
    [options, selectedSet]
  )

  function toggle(address: string) {
    if (selectedSet.has(address)) {
      onChange(selected.filter((a) => a !== address))
    } else {
      onChange([...selected, address])
    }
  }

  const triggerLabel =
    selected.length === 0
      ? "Sélectionner un ou plusieurs destinataires"
      : selected.length <= 2
        ? selectedNames.join(", ")
        : `${selected.length} destinataires sélectionnés`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="outline"
            size="lg"
            className={cn(
              "w-full justify-between font-normal",
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="line-clamp-1 text-left">{triggerLabel}</span>
            <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        )}
      />
      <PopoverContent
        className="w-(--anchor-width) min-w-60 p-0"
        align="start"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un contact…"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aucun contact trouvé
            </p>
          ) : (
            filtered.map((o) => {
              const checked = selectedSet.has(o.address)
              return (
                <button
                  key={o.address}
                  type="button"
                  onClick={() => toggle(o.address)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <div className="flex flex-col">
                    <span>{o.nom}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.digits}
                    </span>
                  </div>
                  {checked && (
                    <Check className="ml-auto size-4 text-primary" />
                  )}
                </button>
              )
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <span className="text-xs text-muted-foreground">
              {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => onChange([])}
            >
              <X className="size-3.5" />
              Tout effacer
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
