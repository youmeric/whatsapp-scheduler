"use client"

import { useActionState, useState, useTransition } from "react"
import { Plus, Search, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Recipient } from "@/lib/types"
import { digitsOnly } from "@/lib/phone"
import {
  createRecipientAction,
  deleteRecipientAction,
  type RecipientActionState,
} from "@/app/(app)/recipients/actions"

export function RecipientsManager({
  recipients,
}: {
  recipients: Recipient[]
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const filtered = recipients.filter((r) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      r.nom.toLowerCase().includes(q) ||
      digitsOnly(r.numero).includes(q.replace(/\D/g, ""))
    )
  })

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Destinataires
          </h1>
          <p className="text-sm text-muted-foreground">
            {recipients.length} contact{recipients.length > 1 ? "s" : ""} dans le
            carnet.
          </p>
        </div>
        <AddRecipientDialog open={open} setOpen={setOpen} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Carnet de contacts
          </CardTitle>
          <CardDescription>
            Les contacts sont stockés dans la feuille 2 du Google Sheet, au
            format <code className="font-mono">{"<numéro>@c.us"}</code>.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 sm:px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un contact…"
              className="pl-8 h-10 sm:h-9"
            />
          </div>
        </CardContent>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nom</TableHead>
                <TableHead>Numéro</TableHead>
                <TableHead className="pr-6 w-[80px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    Aucun contact ne correspond.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <RecipientRow key={r.numero} recipient={r} />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden flex flex-col">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10 px-4">
              Aucun contact ne correspond.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {filtered.map((r) => (
                <RecipientMobileRow key={r.numero} recipient={r} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}

function AddRecipientDialog({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState<RecipientActionState, FormData>(
    async (prev, fd) => {
      const next = await createRecipientAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success("Contact ajouté")
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
            <DialogTitle>Nouveau contact</DialogTitle>
            <DialogDescription>
              Ajouter un destinataire au carnet. Le numéro sera enregistré au
              format WhatsApp ({"<digits>@c.us"}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                name="nom"
                placeholder="Marie Dupont"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero">Numéro</Label>
              <Input
                id="numero"
                name="numero"
                placeholder="+33 6 12 34 56 78"
                required
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">
                Tu peux écrire avec espaces / +. Le format est nettoyé
                automatiquement.
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
              {isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecipientRow({ recipient }: { recipient: Recipient }) {
  const [isPending, startTransition] = useTransition()

  function onDelete() {
    if (
      !confirm(
        `Supprimer ${recipient.nom} (${digitsOnly(recipient.numero)}) ?`
      )
    ) {
      return
    }
    const fd = new FormData()
    fd.set("nom", recipient.nom)
    fd.set("numero", recipient.numero)
    startTransition(async () => {
      const res = await deleteRecipientAction(fd)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("Contact supprimé")
      }
    })
  }

  return (
    <TableRow>
      <TableCell className="pl-6 font-medium">{recipient.nom}</TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {digitsOnly(recipient.numero)}
      </TableCell>
      <TableCell className="pr-6 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          disabled={isPending}
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Supprimer ${recipient.nom}`}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function RecipientMobileRow({ recipient }: { recipient: Recipient }) {
  const [isPending, startTransition] = useTransition()

  function onDelete() {
    if (
      !confirm(
        `Supprimer ${recipient.nom} (${digitsOnly(recipient.numero)}) ?`
      )
    ) {
      return
    }
    const fd = new FormData()
    fd.set("nom", recipient.nom)
    fd.set("numero", recipient.numero)
    startTransition(async () => {
      const res = await deleteRecipientAction(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Contact supprimé")
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{recipient.nom}</p>
        <p className="font-mono text-xs text-muted-foreground truncate">
          {digitsOnly(recipient.numero)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={isPending}
        className="text-muted-foreground hover:text-destructive size-9 shrink-0"
        aria-label={`Supprimer ${recipient.nom}`}
      >
        <Trash2 />
      </Button>
    </li>
  )
}
