import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMessages, getRecipients } from "@/lib/data"
import { getSession } from "@/lib/auth"
import { getMessageAcksMap } from "@/lib/db"
import { MessagesTable } from "@/components/messages-table"
import { StatsCards } from "@/components/stats-cards"
import { DashboardCharts } from "@/components/dashboard-charts"

export default async function MessagesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const [messages, recipients] = await Promise.all([
    getMessages(),
    getRecipients(),
  ])
  const acks = getMessageAcksMap()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Messages programmés
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.filter((m) => !m.envoye).length} en attente ·{" "}
            {messages.filter((m) => m.envoye).length} envoyés
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/messages/calendar" />}
            variant="outline"
          >
            <CalendarDays />
            Calendrier
          </Button>
          <Button nativeButton={false} render={<Link href="/messages/new" />}>
            <Plus />
            Nouveau message
          </Button>
        </div>
      </div>

      <StatsCards messages={messages} />

      <DashboardCharts messages={messages} recipients={recipients} />

      {/* Suspense required because MessagesTable uses useSearchParams. */}
      <Suspense fallback={null}>
        <MessagesTable
          messages={messages}
          recipients={recipients}
          acks={acks}
          currentUser={{ username: session.username, role: session.role }}
        />
      </Suspense>
    </div>
  )
}
