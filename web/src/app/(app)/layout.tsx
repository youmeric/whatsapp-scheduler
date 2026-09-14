import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { BotStatusBanner } from "@/components/bot-status-banner"
import { NotificationsListener } from "@/components/notifications-listener"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BUILD_TIME, displayVersion } from "@/lib/version"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  return (
    <SidebarProvider>
      <AppSidebar username={session.username} role={session.role} />
      <SidebarInset>
        <BotStatusBanner />
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 h-4" />
          <span className="text-sm text-muted-foreground">
            WhatsApp Scheduler
          </span>
          <span
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            title={BUILD_TIME ? `Version ${displayVersion()} · build ${BUILD_TIME}` : `Version ${displayVersion()}`}
          >
            v{displayVersion()}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <NotificationsListener />
      </SidebarInset>
    </SidebarProvider>
  )
}
