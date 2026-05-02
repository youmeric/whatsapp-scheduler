import { LoginForm } from "./login-form"
import { MessageCircle } from "lucide-react"

export default async function LoginPage(props: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await props.searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <MessageCircle className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              WhatsApp Scheduler
            </h1>
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour programmer des messages
            </p>
          </div>
        </div>
        <LoginForm from={from ?? "/messages"} />
      </div>
    </div>
  )
}
