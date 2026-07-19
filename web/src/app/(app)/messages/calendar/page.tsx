import Link from "next/link"
import { redirect } from "next/navigation"
import { List, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMessages, getRecipients } from "@/lib/data"
import { getSession } from "@/lib/auth"
import { MessagesCalendar } from "@/components/messages-calendar"

export default async function MessagesCalendarPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const [messages, recipients] = await Promise.all([
    getMessages(),
    getRecipients(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Calendrier des envois
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.filter((m) => !m.envoye).length} à venir ·{" "}
            {messages.filter((m) => m.envoye).length} envoyés
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/messages" />}
            variant="outline"
          >
            <List />
            Liste
          </Button>
          <Button nativeButton={false} render={<Link href="/messages/new" />}>
            <Plus />
            Nouveau message
          </Button>
        </div>
      </div>

      <MessagesCalendar messages={messages} recipients={recipients} />
    </div>
  )
}
