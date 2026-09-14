import { redirect } from "next/navigation"

import { getRecipients } from "@/lib/data"
import { getSession } from "@/lib/auth"
import { listRecipientGroups } from "@/lib/db"
import type { RecipientGroup } from "@/lib/types"
import { RecipientsManager } from "@/components/recipients-manager"
import { GroupsManager } from "@/components/groups-manager"

export default async function RecipientsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const recipients = await getRecipients()
  const groups: RecipientGroup[] = listRecipientGroups().map((g) => ({
    id: g.id,
    nom: g.nom,
    numeros: g.numeros ? g.numeros.split(",").filter(Boolean) : [],
    cree_par: g.cree_par,
    cree_le: g.cree_le,
  }))

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <RecipientsManager recipients={recipients} />
      <GroupsManager
        groups={groups}
        recipients={recipients}
        currentUser={{ username: session.username, role: session.role }}
      />
    </div>
  )
}
