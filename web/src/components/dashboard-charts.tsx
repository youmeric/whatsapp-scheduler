import { BarChart3, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Recipient, ScheduledMessage } from "@/lib/types"
import { buildRecipientNameByDigits, digitsOnly } from "@/lib/phone"

const WEEKS = 8

function parseIso(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Lundi de la semaine contenant `d` (à minuit). */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (out.getDay() + 6) % 7 // 0 = lundi
  out.setDate(out.getDate() - dow)
  return out
}

const weekLabelFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "numeric",
})

export function DashboardCharts({
  messages,
  recipients,
}: {
  messages: ScheduledMessage[]
  recipients: Recipient[]
}) {
  // ---- Envois par semaine (8 dernières semaines, alignées lundi) ----
  const currentMonday = mondayOf(new Date())
  const weekBuckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(currentMonday)
    start.setDate(start.getDate() - (WEEKS - 1 - i) * 7)
    return { start, count: 0 }
  })
  const firstStart = weekBuckets[0].start.getTime()

  for (const m of messages) {
    const d = parseIso(m.date_envoi)
    if (!d) continue
    const wk = mondayOf(d).getTime()
    if (wk < firstStart) continue
    const idx = Math.round((wk - firstStart) / (7 * 86400000))
    if (idx >= 0 && idx < WEEKS) weekBuckets[idx].count++
  }
  const maxWeek = Math.max(1, ...weekBuckets.map((b) => b.count))

  // ---- Top destinataires ----
  const nameByDigits = buildRecipientNameByDigits(recipients)
  const counts = new Map<string, number>()
  for (const m of messages) {
    const key = digitsOnly(m.destinataire)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const top = Array.from(counts.entries())
    .map(([digits, count]) => ({
      label: nameByDigits.get(digits) ?? digits,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const maxTop = Math.max(1, ...top.map((t) => t.count))

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Envois par semaine */}
      <Card className="gap-2 py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BarChart3 className="size-4 text-blue-700 dark:text-blue-400" />
            Envois par semaine
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex h-28 items-end gap-1.5">
            {weekBuckets.map((b, i) => {
              const pct = Math.round((b.count / maxWeek) * 100)
              return (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`Semaine du ${weekLabelFmt.format(b.start)} : ${b.count}`}
                >
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {b.count || ""}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-primary/80 transition-all"
                      style={{ height: `${Math.max(pct, b.count ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {weekLabelFmt.format(b.start)}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top destinataires */}
      <Card className="gap-2 py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-4 text-emerald-700 dark:text-emerald-400" />
            Top destinataires
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune donnée.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {top.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-xs" title={t.label}>
                    {t.label}
                  </span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-emerald-600/70 dark:bg-emerald-500/60"
                      style={{ width: `${Math.round((t.count / maxTop) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
