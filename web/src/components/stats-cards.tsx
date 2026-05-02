import { CalendarClock, CalendarDays, CheckCheck, Clock } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ScheduledMessage } from "@/lib/types"
import { cn } from "@/lib/utils"

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
})

function isoToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isoPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatRelativeDay(iso: string, today: string): string {
  if (iso === today) return "aujourd'hui"
  if (iso === isoPlusDays(1)) return "demain"
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return dateFormatter.format(new Date(y, m - 1, d))
}

export function StatsCards({ messages }: { messages: ScheduledMessage[] }) {
  const today = isoToday()
  const in7days = isoPlusDays(7)

  const pending = messages.filter((m) => !m.envoye)
  const sent = messages.filter((m) => m.envoye)

  // Next upcoming pending message (smallest future date_envoi).
  const upcoming = [...pending]
    .filter((m) => m.date_envoi >= today)
    .sort((a, b) => a.date_envoi.localeCompare(b.date_envoi))
  const next = upcoming[0]

  // Pending in the next 7 days (inclusive).
  const thisWeek = pending.filter(
    (m) => m.date_envoi >= today && m.date_envoi <= in7days
  ).length

  // Sent in the last 7 days (rough — uses date_envoi since cree_le is creation).
  const past7 = isoPlusDays(-7)
  const sentRecent = sent.filter(
    (m) => m.date_envoi >= past7 && m.date_envoi <= today
  ).length

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      <StatCard
        icon={<CalendarClock className="size-4" />}
        label="En attente"
        value={pending.length}
        accent="text-amber-700 dark:text-amber-400"
      />
      <StatCard
        icon={<CalendarDays className="size-4" />}
        label="7 prochains jours"
        value={thisWeek}
        accent="text-blue-700 dark:text-blue-400"
      />
      <StatCard
        icon={<CheckCheck className="size-4" />}
        label="Envoyés (7j)"
        value={sentRecent}
        accent="text-emerald-700 dark:text-emerald-400"
      />
      <Card className="overflow-hidden gap-1 py-3 sm:py-4">
        <CardHeader className="px-3 sm:px-4 pb-0">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="size-4 text-purple-700 dark:text-purple-400 shrink-0" />
            <span className="truncate">Prochain envoi</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-0">
          {next ? (
            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-base font-semibold tabular-nums capitalize truncate">
                {formatRelativeDay(next.date_envoi, today)}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {next.destinataire}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Aucun</span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent?: string
}) {
  return (
    <Card className="gap-1 py-3 sm:py-4">
      <CardHeader className="px-3 sm:px-4 pb-0">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className={cn("shrink-0", accent)}>{icon}</span>
          <span className="truncate">{label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-0">
        <span className="text-xl sm:text-2xl font-semibold tabular-nums">
          {value}
        </span>
      </CardContent>
    </Card>
  )
}
