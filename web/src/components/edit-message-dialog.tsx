"use client"

import { useActionState, useState, useTransition } from "react"
import { CalendarIcon, Paperclip, Pencil } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import type { Recipient, ScheduledMessage } from "@/lib/types"
import {
  updateMessageAction,
  type UpdateMessageState,
} from "@/app/(app)/messages/actions"

const MAX_LEN = 1500

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fromIsoDate(iso: string): Date | undefined {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return undefined
  const out = new Date(y, m - 1, d)
  out.setHours(0, 0, 0, 0)
  return out
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const HOURS: string[] = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6
  return `${String(h).padStart(2, "0")}:00`
})

export function EditMessageDialog({
  message,
  recipients,
}: {
  message: ScheduledMessage
  recipients: Recipient[]
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(() =>
    fromIsoDate(message.date_envoi)
  )
  const [heure, setHeure] = useState<string>(message.heure_envoi ?? "10:00")
  // The destinataire stored in the sheet is "<digits>@c.us". The Select's
  // values are also "<digits>@c.us" so the initial value matches if the
  // recipient is still in the carnet.
  const [destinataire, setDestinataire] = useState<string>(message.destinataire)
  const [text, setText] = useState<string>(message.message)
  const [attachment, setAttachment] = useState<AttachmentValue>(() =>
    message.attachment_url
      ? {
          url: message.attachment_url,
          filename: message.attachment_filename ?? "Pièce jointe",
        }
      : null
  )
  const [isPending, startTransition] = useTransition()

  const [state, formAction] = useActionState<UpdateMessageState, FormData>(
    async (prev, fd) => {
      const next = await updateMessageAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success("Message mis à jour")
        setOpen(false)
      }
      return next
    },
    null
  )

  const today = startOfToday()
  const charsLeft = MAX_LEN - text.length
  const canSubmit =
    !!date && !!destinataire && text.trim().length > 0 && charsLeft >= 0

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    const fd = new FormData(e.currentTarget)
    startTransition(() => formAction(fd))
  }

  // When opening, reset state to the latest message values (in case the row
  // re-rendered with newer data after a previous edit).
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setDate(fromIsoDate(message.date_envoi))
      setHeure(message.heure_envoi ?? "10:00")
      setDestinataire(message.destinataire)
      setText(message.message)
      setAttachment(
        message.attachment_url
          ? {
              url: message.attachment_url,
              filename: message.attachment_filename ?? "Pièce jointe",
            }
          : null
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-9 md:size-7"
            aria-label="Modifier ce message"
            title="Modifier"
          >
            <Pencil />
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="id" value={message.id} />
          <input
            type="hidden"
            name="date_envoi"
            value={date ? toIsoDate(date) : ""}
          />
          <input type="hidden" name="heure_envoi" value={heure} />
          <input type="hidden" name="destinataire" value={destinataire} />
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

          <DialogHeader>
            <DialogTitle>Modifier le message</DialogTitle>
            <DialogDescription>
              Le message sera envoyé automatiquement à l&apos;heure choisie le
              jour sélectionné.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-4">
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
                <Select
                  value={heure}
                  onValueChange={(v) => setHeure(v ?? "10:00")}
                >
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

            <div className="space-y-2">
              <Label>Destinataire</Label>
              <Select
                value={destinataire}
                onValueChange={(v) => setDestinataire(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un destinataire" />
                </SelectTrigger>
                <SelectContent>
                  {recipients.map((r) => {
                    const address = toWhatsappAddress(r.numero)
                    return (
                      <SelectItem key={address || r.nom} value={address}>
                        <div className="flex flex-col">
                          <span>{r.nom}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {digitsOnly(r.numero)}
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                  {/* If the current destinataire isn't in the recipients list
                      (e.g. the contact was removed), keep it selectable so the
                      user can see + change it. */}
                  {destinataire &&
                    !recipients.some(
                      (r) => toWhatsappAddress(r.numero) === destinataire
                    ) && (
                      <SelectItem value={destinataire}>
                        <div className="flex flex-col">
                          <span className="italic">
                            Contact retiré du carnet
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {digitsOnly(destinataire)}
                          </span>
                        </div>
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`msg-${message.id}`}>Message</Label>
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
                id={`msg-${message.id}`}
                name="message"
                value={text}
                onChange={setText}
                rows={6}
                required
              />
            </div>

            {/* Attachment */}
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="size-3.5 text-muted-foreground" />
                Pièce jointe (optionnel)
              </Label>
              <AttachmentPicker value={attachment} onChange={setAttachment} />
            </div>

            {state?.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="ghost">
                  Annuler
                </Button>
              }
            />
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
