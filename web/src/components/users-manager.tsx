"use client"

import { useActionState, useState, useTransition } from "react"
import {
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
  type UserActionState,
} from "@/app/(app)/admin/users/actions"

type Role = "super_admin" | "admin" | "user"

type UserRow = {
  id: number
  username: string
  role: Role
  created_at: string
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatCreatedAt(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"))
  if (isNaN(d.getTime())) return iso
  return dateFormatter.format(d)
}

function roleLabel(role: Role): string {
  return role === "super_admin"
    ? "Super admin"
    : role === "admin"
      ? "Admin"
      : "Utilisateur"
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "super_admin") {
    return (
      <Badge className="gap-1">
        <ShieldCheck className="size-3" />
        Super admin
      </Badge>
    )
  }
  if (role === "admin") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Shield className="size-3" />
        Admin
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <User className="size-3" />
      Utilisateur
    </Badge>
  )
}

export function UsersManager({
  users,
  currentUserId,
  currentUserRole,
}: {
  users: UserRow[]
  currentUserId: number
  currentUserRole: Role
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UserCog className="size-6" />
            Utilisateurs
          </h1>
          <p className="text-sm text-muted-foreground">
            {users.length} utilisateur{users.length > 1 ? "s" : ""} —{" "}
            {users.filter((u) => u.role === "super_admin").length} super-admin
            {users.filter((u) => u.role === "super_admin").length > 1 ? "s" : ""}
            , {users.filter((u) => u.role === "admin").length} admin
            {users.filter((u) => u.role === "admin").length > 1 ? "s" : ""}
          </p>
        </div>
        <AddUserDialog
          open={open}
          setOpen={setOpen}
          currentUserRole={currentUserRole}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comptes</CardTitle>
          <CardDescription>
            Les administrateurs gèrent les utilisateurs et les admins. Seul un
            super-admin peut modifier ou supprimer un autre super-admin.
          </CardDescription>
        </CardHeader>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Identifiant</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="pr-6 w-[120px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <ul className="md:hidden divide-y border-t">
          {users.map((u) => (
            <UserMobileRow
              key={u.id}
              user={u}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </ul>
      </Card>
    </div>
  )
}

function AddUserDialog({
  open,
  setOpen,
  currentUserRole,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  currentUserRole: Role
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState<UserActionState, FormData>(
    async (prev, fd) => {
      const next = await createUserAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success("Utilisateur créé")
        setOpen(false)
      }
      return next
    },
    null
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => formAction(fd))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Ajouter
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Crée un compte pour qu'une personne puisse se connecter au site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Identifiant</Label>
              <Input
                id="username"
                name="username"
                required
                autoFocus
                placeholder="prenom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={4}
              />
              <p className="text-xs text-muted-foreground">
                Min. 4 caractères. L'utilisateur pourra le changer plus tard.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select name="role" defaultValue="user">
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utilisateur</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {currentUserRole === "super_admin" && (
                    <SelectItem value="super_admin">Super admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Les admins gèrent les utilisateurs. Les super-admins gèrent
                aussi les autres admins.
              </p>
            </div>
            {state?.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="ghost">
                  Annuler
                </Button>
              }
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UserRow({
  user,
  currentUserId,
  currentUserRole,
}: {
  user: UserRow
  currentUserId: number
  currentUserRole: Role
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isMe = user.id === currentUserId

  // Permission rules (mirrors server-side):
  //   - super_admin can edit/delete anyone
  //   - admin can edit/delete user|admin only (not super_admin)
  const canEdit =
    currentUserRole === "super_admin" || user.role !== "super_admin"
  const canDelete = canEdit && !isMe

  function onDelete() {
    if (!confirm(`Supprimer le compte « ${user.username} » ?`)) return
    const fd = new FormData()
    fd.set("id", String(user.id))
    startTransition(async () => {
      const res = await deleteUserAction(fd)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("Compte supprimé")
      }
    })
  }

  return (
    <TableRow>
      <TableCell className="pl-6 font-medium">
        {user.username}
        {isMe && (
          <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
        )}
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatCreatedAt(user.created_at)}
      </TableCell>
      <TableCell className="pr-6 text-right">
        <div className="flex justify-end gap-1">
          {canEdit && (
            <EditUserDialog
              open={editOpen}
              setOpen={setEditOpen}
              user={user}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            disabled={isPending || !canDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Supprimer ${user.username}`}
            title={
              isMe
                ? "Tu ne peux pas te supprimer toi-même"
                : !canEdit
                  ? "Seul un super-admin peut supprimer ce compte"
                  : "Supprimer"
            }
          >
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function UserMobileRow({
  user,
  currentUserId,
  currentUserRole,
}: {
  user: UserRow
  currentUserId: number
  currentUserRole: Role
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isMe = user.id === currentUserId

  const canEdit =
    currentUserRole === "super_admin" || user.role !== "super_admin"
  const canDelete = canEdit && !isMe

  function onDelete() {
    if (!confirm(`Supprimer le compte « ${user.username} » ?`)) return
    const fd = new FormData()
    fd.set("id", String(user.id))
    startTransition(async () => {
      const res = await deleteUserAction(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Compte supprimé")
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{user.username}</span>
          {isMe && <span className="text-xs text-muted-foreground">(toi)</span>}
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role={user.role} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCreatedAt(user.created_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {canEdit && (
          <EditUserDialog
            open={editOpen}
            setOpen={setEditOpen}
            user={user}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={isPending || !canDelete}
          className="text-muted-foreground hover:text-destructive size-9"
          aria-label={`Supprimer ${user.username}`}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

function EditUserDialog({
  open,
  setOpen,
  user,
  currentUserId,
  currentUserRole,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  user: UserRow
  currentUserId: number
  currentUserRole: Role
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState<UserActionState, FormData>(
    async (prev, fd) => {
      const next = await updateUserAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success("Compte mis à jour")
        setOpen(false)
      }
      return next
    },
    null
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => formAction(fd))
  }

  const isSelf = user.id === currentUserId

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-9 md:size-7"
            aria-label={`Modifier ${user.username}`}
            title="Modifier"
          >
            <Pencil />
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="id" value={user.id} />

          <DialogHeader>
            <DialogTitle>
              Modifier{" "}
              <span className="font-mono text-base">{user.username}</span>
            </DialogTitle>
            <DialogDescription>
              Laisse le champ mot de passe vide pour ne pas le changer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`pw-${user.id}`}>Nouveau mot de passe</Label>
              <Input
                id={`pw-${user.id}`}
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={4}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Min. 4 caractères. Vide = inchangé.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`role-${user.id}`}>Rôle</Label>
              <Select name="role" defaultValue={user.role}>
                <SelectTrigger id={`role-${user.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utilisateur</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {/* super_admin option only if you ARE a super_admin
                      (or the target already is one — in which case you must
                      be a super_admin to edit them anyway) */}
                  {currentUserRole === "super_admin" && (
                    <SelectItem value="super_admin">Super admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {isSelf && user.role === "super_admin" && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Tu peux te rétrograder, mais seulement s'il y a un autre
                  super-admin.
                </p>
              )}
            </div>

            {state?.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="ghost">
                  Annuler
                </Button>
              }
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
