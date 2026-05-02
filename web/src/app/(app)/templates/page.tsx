import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth"
import { listTemplates } from "@/lib/db"
import type { Template } from "@/lib/types"
import { TemplatesManager } from "@/components/templates-manager"

export default async function TemplatesPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const rows = listTemplates()
  const templates: Template[] = rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    contenu: r.contenu,
    cree_par: r.cree_par,
    cree_le: r.cree_le,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Modèles de messages
        </h1>
        <p className="text-sm text-muted-foreground">
          Sauvegarde des messages réutilisables. Disponibles dans le formulaire
          de création de message.
        </p>
      </div>

      <TemplatesManager
        templates={templates}
        currentUser={{ username: session.username, role: session.role }}
      />
    </div>
  )
}
