"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { buildRecipientNameByDigits, digitsOnly } from "@/lib/phone"
import type { Recipient, ScheduledMessage } from "@/lib/types"

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const monthLabelFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
})

function isoKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function todayIso(): string {
  const d = new Date()
  return isoKey(d.getFullYear(), d.getMonth(), d.getDate())
}

export function MessagesCalendar({
  messages,
  recipients,
}: {
  messages: ScheduledMessage[]
  recipients: Recipient[]
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const nameByDigits = useMemo(
    () => buildRecipientNameByDigits(recipients),
    [recipients]
  )

  // Group messages by ISO date for O(1) day lookups.
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduledMessage[]>()
    for (const m of messages) {
      const list = map.get(m.date_envoi)
      if (list) list.push(m)
      else map.set(m.date_envoi, [m])
    }
    // Sort each day's messages by time.
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.heure_envoi ?? "10:00").localeCompare(b.heure_envoi ?? "10:00")
      )
    }
    return map
  }, [messages])

  const { year, month } = cursor
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Monday-first offset (JS getDay: 0=Sun … 6=Sat).
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7
  const today = todayIso()

  // Build the grid cells (leading blanks + each day).
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function goToday() {
    const d = new Date()
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  const monthLabel = monthLabelFmt.format(firstOfMonth)

  return (
    <div className="flex flex-col gap-3">
      {/* Header: month navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => shiftMonth(-1)}
          aria-label="Mois précédent"
          className="size-9"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-[180px] text-center text-sm font-medium capitalize tabular-nums">
          {monthLabel}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => shiftMonth(1)}
          aria-label="Mois suivant"
          className="size-9"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={goToday}
          className="ml-1 h-9"
        >
          Aujourd&apos;hui
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`blank-${idx}`}
                  className="min-h-24 border-b border-r bg-muted/20"
                />
              )
            }
            const key = isoKey(year, month, day)
            const dayMessages = byDate.get(key) ?? []
            const isToday = key === today
            return (
              <div
                key={key}
                className="min-h-24 border-b border-r p-1.5 last:border-r-0"
              >
                <div
                  className={cn(
                    "mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {day}
                </div>
                <div className="flex flex-col gap-1">
                  {dayMessages.map((m) => {
                    const name =
                      nameByDigits.get(digitsOnly(m.destinataire)) ??
                      digitsOnly(m.destinataire)
                    return (
                      <div
                        key={m.id}
                        title={`${m.heure_envoi ?? "10:00"} · ${name} — ${m.message}`}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-xs",
                          m.envoye
                            ? "bg-muted text-muted-foreground line-through"
                            : "bg-primary/10 text-foreground"
                        )}
                      >
                        <span className="tabular-nums text-muted-foreground">
                          {m.heure_envoi ?? "10:00"}
                        </span>{" "}
                        {name}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-primary/10 ring-1 ring-inset ring-primary/20" />
          À venir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-muted ring-1 ring-inset ring-border" />
          Envoyé
        </span>
      </div>
    </div>
  )
}
