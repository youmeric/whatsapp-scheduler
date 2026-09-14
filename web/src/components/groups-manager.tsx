"use client"

import { useActionState, useMemo, useState, useTransition } from "react"
import {
  Check,
  ChevronDownIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Recipient, RecipientGroup } from "@/lib/types"
import { digitsOnly } from "@/lib/phone"
import { cn } from "@/lib/utils"
import {
  createGroupAction,
  deleteGroupAction,
  updateGroupAction,
  type GroupActionState,
} from "@/app/(app)/recipients/actions"

type CurrentUser = { username: string; role: "super_admin" | "admin" | "user" }

function isAdminOrAbove(role: CurrentUser["role"]): boolean {
  return role === "admin" || role === "super_admin"
}

export function GroupsManager({
  groups,
  recipients,
  currentUser,
}: {
  groups: RecipientGroup[]
  recipients: Recipient[]
  currentUser: CurrentUser
}) {
  const nameByDigits = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recipients) m.set(digitsOnly(r.numero), r.nom)
    return m
  }, [recipients])

  return (
    <Card className="p-4 sm:p-6 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <UsersRound className="size-4" />
            Groupes / listes de diffusion
          </h2>
          <p className="text-sm text-muted-foreground">
            Regroupe des contacts pour les ajouter d&apos;un clic dans un
            message.
          </p>
        </div>
        <GroupDialog recipients={recipients} mode="create" />
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun groupe. Crée-en un pour envoyer plus vite à un ensemble de
          contacts.
        </p>
      ) : (
        <ul className="divide-y">
          {groups.map((g) => {
            const canManage =
              isAdminOrAbove(currentUser.role) ||
              g.cree_par === currentUser.username
            const names = g.numeros
              .map((n) => nameByDigits.get(n) ?? n)
              .slice(0, 4)
            return (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">
                    {g.nom}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {g.numeros.length} contact
                      {g.numeros.length > 1 ? "s" : ""}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {names.join(", ")}
                    {g.numeros.length > names.length ? "…" : ""}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <GroupDialog
                      recipients={recipients}
                      mode="edit"
                      group={g}
                    />
                    <DeleteGroupButton id={g.id} nom={g.nom} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function GroupDialog({
  recipients,
  mode,
  group,
}: {
  recipients: Recipient[]
  mode: "create" | "edit"
  group?: RecipientGroup
}) {
  const [open, setOpen] = useState(false)
  const [nom, setNom] = useState(group?.nom ?? "")
  const [numeros, setNumeros] = useState<string[]>(group?.numeros ?? [])
  const [isPending, startTransition] = useTransition()

  const action = mode === "create" ? createGroupAction : updateGroupAction
  const [state, formAction] = useActionState<GroupActionState, FormData>(
    async (prev, fd) => {
      const next = await action(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success(mode === "create" ? "Groupe créé" : "Groupe mis à jour")
        setOpen(false)
      }
      return next
    },
    null
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setNom(group?.nom ?? "")
      setNumeros(group?.numeros ?? [])
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => formAction(fd))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button size="sm">
              <Plus />
              Nouveau groupe
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-9 md:size-7"
              aria-label={`Modifier ${group?.nom}`}
              title="Modifier"
            >
              <Pencil />
            </Button>
          )
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          {mode === "edit" && group ? (
            <input type="hidden" name="id" value={group.id} />
          ) : null}
          <input type="hidden" name="numeros" value={numeros.join(",")} />

          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Nouveau groupe" : "Modifier le groupe"}
            </DialogTitle>
            <DialogDescription>
              Donne un nom au groupe et choisis ses membres dans le carnet.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-nom">Nom du groupe</Label>
              <Input
                id="group-nom"
                name="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Famille"
                maxLength={60}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Membres</Label>
              <MembersPicker
                recipients={recipients}
                selected={numeros}
                onChange={setNumeros}
              />
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
            <Button
              type="submit"
              disabled={isPending || nom.trim().length === 0}
            >
              {isPending
                ? "Enregistrement…"
                : mode === "create"
                  ? "Créer"
                  : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Sélecteur de membres par numéro (chiffres). */
function MembersPicker({
  recipients,
  selected,
  onChange,
}: {
  recipients: Recipient[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const options = useMemo(
    () =>
      recipients
        .map((r) => ({ digits: digitsOnly(r.numero), nom: r.nom }))
        .filter((o) => o.digits),
    [recipients]
  )
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const qd = query.replace(/\D/g, "")
    if (!q) return options
    return options.filter(
      (o) =>
        o.nom.toLowerCase().includes(q) ||
        (qd.length > 0 && o.digits.includes(qd))
    )
  }, [options, query])

  function toggle(digits: string) {
    if (selectedSet.has(digits)) onChange(selected.filter((d) => d !== digits))
    else onChange([...selected, digits])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between font-normal",
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="line-clamp-1 text-left">
              {selected.length === 0
                ? "Choisir des contacts"
                : `${selected.length} contact${selected.length > 1 ? "s" : ""}`}
            </span>
            <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        )}
      />
      <PopoverContent className="w-(--anchor-width) min-w-60 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un contact…"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aucun contact trouvé
            </p>
          ) : (
            filtered.map((o) => {
              const checked = selectedSet.has(o.digits)
              return (
                <button
                  key={o.digits}
                  type="button"
                  onClick={() => toggle(o.digits)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <div className="flex flex-col">
                    <span>{o.nom}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.digits}
                    </span>
                  </div>
                  {checked && <Check className="ml-auto size-4 text-primary" />}
                </button>
              )
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <span className="text-xs text-muted-foreground">
              {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => onChange([])}
            >
              Tout effacer
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function DeleteGroupButton({ id, nom }: { id: number; nom: string }) {
  const [isPending, startTransition] = useTransition()
  function onClick() {
    if (!confirm(`Supprimer le groupe « ${nom} » ?`)) return
    const fd = new FormData()
    fd.set("id", String(id))
    startTransition(async () => {
      const res = await deleteGroupAction(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Groupe supprimé")
    })
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive size-9 md:size-7"
      aria-label={`Supprimer ${nom}`}
      title="Supprimer"
    >
      <Trash2 />
    </Button>
  )
}
