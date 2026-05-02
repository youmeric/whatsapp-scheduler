import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { isAdminOrAbove, listUsers } from "@/lib/db"
import { UsersManager } from "@/components/users-manager"

export default async function UsersPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!isAdminOrAbove(session.role)) redirect("/messages")

  const users = listUsers()
  return (
    <UsersManager
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        created_at: u.created_at,
      }))}
      currentUserId={session.id}
      currentUserRole={session.role}
    />
  )
}
