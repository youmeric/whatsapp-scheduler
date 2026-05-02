"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import {
  countByRole,
  createUser,
  deleteUser,
  findUserById,
  isAdminOrAbove,
  ROLES,
  updateUser,
  type Role,
} from "@/lib/db"

export type UserActionState = { ok?: boolean; error?: string } | null

async function requireAdmin(): Promise<
  { ok: true; sessionRole: Role; sessionId: number; sessionUsername: string } | { ok: false; error: string }
> {
  const s = await getSession()
  if (!s) return { ok: false, error: "Session expirée." }
  if (!isAdminOrAbove(s.role)) {
    return { ok: false, error: "Accès refusé : admin requis." }
  }
  return { ok: true, sessionRole: s.role, sessionId: s.id, sessionUsername: s.username }
}

function isValidRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v)
}

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const role = String(formData.get("role") ?? "user")

  if (!username) return { error: "Identifiant obligatoire." }
  if (!/^[a-zA-Z0-9_.\-]{2,32}$/.test(username)) {
    return { error: "Identifiant : 2-32 caractères, lettres / chiffres / _ . -" }
  }
  if (password.length < 4) return { error: "Mot de passe : min 4 caractères." }
  if (!isValidRole(role)) return { error: "Rôle invalide." }

  // Only super_admins can create super_admins.
  if (role === "super_admin" && auth.sessionRole !== "super_admin") {
    return { error: "Seul un super-admin peut créer un super-admin." }
  }

  const result = createUser(username, password, role)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: auth.sessionUsername,
    action: "create_user",
    target: String(result.id),
    details: { username, role },
  })
  revalidatePath("/admin/users")
  return { ok: true }
}

export async function updateUserAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const id = Number(formData.get("id") ?? 0)
  if (!id) return { error: "ID invalide." }

  const target = findUserById(id)
  if (!target) return { error: "Utilisateur introuvable." }

  // Only super_admins can modify super_admins.
  if (target.role === "super_admin" && auth.sessionRole !== "super_admin") {
    return { error: "Seul un super-admin peut modifier un super-admin." }
  }

  const passwordRaw = String(formData.get("password") ?? "")
  const newRoleRaw = String(formData.get("role") ?? "")

  const changes: { password?: string; role?: Role } = {}

  if (passwordRaw.trim() !== "") {
    if (passwordRaw.length < 4)
      return { error: "Mot de passe : min 4 caractères." }
    changes.password = passwordRaw
  }

  if (newRoleRaw && newRoleRaw !== target.role) {
    if (!isValidRole(newRoleRaw)) return { error: "Rôle invalide." }
    // Only super_admins can promote anyone to super_admin.
    if (newRoleRaw === "super_admin" && auth.sessionRole !== "super_admin") {
      return { error: "Seul un super-admin peut nommer un super-admin." }
    }
    // Cannot demote the last super_admin.
    if (
      target.role === "super_admin" &&
      newRoleRaw !== "super_admin" &&
      countByRole("super_admin") <= 1
    ) {
      return {
        error: "Impossible de retirer le dernier super-admin de son rôle.",
      }
    }
    changes.role = newRoleRaw
  }

  if (Object.keys(changes).length === 0) {
    return { ok: true }
  }

  const result = updateUser(id, changes)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: auth.sessionUsername,
    action: "update_user",
    target: String(id),
    details: {
      target_username: target.username,
      ...(changes.role ? { role: changes.role } : {}),
      ...(changes.password ? { password_changed: true } : {}),
    },
  })
  revalidatePath("/admin/users")
  return { ok: true }
}

export async function deleteUserAction(
  formData: FormData
): Promise<UserActionState> {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const id = Number(formData.get("id") ?? 0)
  if (!id) return { error: "ID invalide." }

  if (auth.sessionId === id) {
    return { error: "Tu ne peux pas supprimer ton propre compte." }
  }

  const target = findUserById(id)
  if (!target) return { error: "Utilisateur introuvable." }

  // Admins cannot delete super_admins.
  if (target.role === "super_admin" && auth.sessionRole !== "super_admin") {
    return { error: "Seul un super-admin peut supprimer un super-admin." }
  }

  // Last super_admin protection.
  if (target.role === "super_admin" && countByRole("super_admin") <= 1) {
    return { error: "Impossible de supprimer le dernier super-admin." }
  }

  const result = deleteUser(id)
  if (!result.ok) return { error: result.error }

  logAudit({
    username: auth.sessionUsername,
    action: "delete_user",
    target: String(id),
    details: { username: target.username, role: target.role },
  })
  revalidatePath("/admin/users")
  return { ok: true }
}
