import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRecipients } from "@/lib/data"
import { listTemplates } from "@/lib/db"
import type { Template } from "@/lib/types"
import { NewMessageForm } from "@/components/new-message-form"

export default async function NewMessagePage(props: {
  searchParams: Promise<{
    message?: string
    destinataire?: string
    heure?: string
  }>
}) {
  const { message, destinataire, heure } = await props.searchParams
  const recipients = await getRecipients()
  const rows = listTemplates()
  const templates: Template[] = rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    contenu: r.contenu,
    cree_par: r.cree_par,
    cree_le: r.cree_le,
  }))

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/messages" />}
          variant="ghost"
          size="sm"
          className="self-start -ml-2"
        >
          <ArrowLeft />
          Retour aux messages
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nouveau message programmé
          </h1>
          <p className="text-sm text-muted-foreground">
            Le message sera envoyé automatiquement à l&apos;heure choisie le
            jour sélectionné.
          </p>
        </div>
      </div>

      <NewMessageForm
        recipients={recipients}
        templates={templates}
        initialMessage={message}
        initialDestinataires={destinataire ? [destinataire] : undefined}
        initialHeure={heure}
      />
    </div>
  )
}
