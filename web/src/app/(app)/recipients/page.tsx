import { getRecipients } from "@/lib/data"
import { RecipientsManager } from "@/components/recipients-manager"

export default async function RecipientsPage() {
  const recipients = await getRecipients()
  return <RecipientsManager recipients={recipients} />
}
