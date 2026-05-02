import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth"
import { isAdminOrAbove, listAuditLogs } from "@/lib/db"
import type { AuditLog } from "@/lib/types"
import { AuditLogTable } from "@/components/audit-log-table"

export default async function AuditPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!isAdminOrAbove(session.role)) redirect("/messages")

  const { rows, total } = listAuditLogs({ limit: 500 })
  const entries: AuditLog[] = rows.map((r) => ({
    id: r.id,
    username: r.username,
    action: r.action,
    target: r.target,
    details: r.details,
    created_at: r.created_at,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Journal d&apos;audit
        </h1>
        <p className="text-sm text-muted-foreground">
          Historique des actions sur les messages, destinataires, modèles et
          utilisateurs. Affiche les {entries.length} entrées les plus récentes
          (sur {total} au total).
        </p>
      </div>

      <AuditLogTable entries={entries} />
    </div>
  )
}
