"use client"

import { useActionState, useMemo, useState, useTransition } from "react"
import {
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MessageEditor } from "@/components/message-editor"
import type { Template } from "@/lib/types"
import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
  type TemplateActionState,
} from "@/app/(app)/templates/actions"

type CurrentUser = {
  username: string
  role: "super_admin" | "admin" | "user"
}

function isAdminOrAbove(role: CurrentUser["role"]): boolean {
  return role === "admin" || role === "super_admin"
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateFormatter.format(d)
}

export function TemplatesManager({
  templates,
  currentUser,
}: {
  templates: Template[]
  currentUser: CurrentUser
}) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (t) =>
        t.nom.toLowerCase().includes(q) ||
        t.contenu.toLowerCase().includes(q)
    )
  }, [templates, query])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un modèle…"
            className="pl-8 h-10 sm:h-9"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <CreateTemplateDialog />
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length} sur {templates.length}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <FileText className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {templates.length === 0
                ? "Aucun modèle pour l'instant"
                : "Aucun modèle ne correspond"}
            </p>
            <p className="text-xs text-muted-foreground">
              {templates.length === 0
                ? "Crée ton premier modèle pour réutiliser tes messages favoris."
                : "Essaie une autre recherche."}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Nom</TableHead>
                  <TableHead>Contenu</TableHead>
                  <TableHead className="w-[140px]">Créé par</TableHead>
                  <TableHead className="w-[120px]">Créé le</TableHead>
                  <TableHead className="w-[110px] text-right pr-4">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const canManage =
                    isAdminOrAbove(currentUser.role) ||
                    t.cree_par === currentUser.username
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nom}</TableCell>
                      <TableCell className="max-w-[420px] truncate text-muted-foreground">
                        {t.contenu}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {t.cree_par}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatDate(t.cree_le)}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {canManage ? (
                          <div className="flex justify-end gap-1">
                            <EditTemplateDialog template={t} />
                            <DeleteTemplateButton id={t.id} nom={t.nom} />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-2">
            {filtered.map((t) => {
              const canManage =
                isAdminOrAbove(currentUser.role) ||
                t.cree_par === currentUser.username
              return (
                <Card key={t.id} className="p-3 gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm flex-1 min-w-0 break-words">
                      {t.nom}
                    </p>
                    {canManage ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <EditTemplateDialog template={t} />
                        <DeleteTemplateButton id={t.id} nom={t.nom} />
                      </div>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {t.contenu}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    par {t.cree_par} · {formatDate(t.cree_le)}
                  </p>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function CreateTemplateDialog() {
  const [open, setOpen] = useState(false)
  const [nom, setNom] = useState("")
  const [contenu, setContenu] = useState("")
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState<TemplateActionState, FormData>(
    async (prev, fd) => {
      const next = await createTemplateAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success("Modèle créé")
        setOpen(false)
        setNom("")
        setContenu("")
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

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setNom("")
      setContenu("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-9">
            <Plus />
            Nouveau modèle
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nouveau modèle</DialogTitle>
            <DialogDescription>
              Sauvegarde un message réutilisable dans la création d&apos;un
              nouveau message.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-nom">Nom du modèle</Label>
              <Input
                id="tpl-nom"
                name="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Rappel RDV"
                maxLength={60}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-contenu">Contenu</Label>
              <MessageEditor
                id="tpl-contenu"
                name="contenu"
                value={contenu}
                onChange={setContenu}
                rows={6}
                placeholder="Bonjour, …"
                required
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
              disabled={
                isPending ||
                nom.trim().length === 0 ||
                contenu.trim().length === 0
              }
            >
              {isPending ? "Enregistrement…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditTemplateDialog({ template }: { template: Template }) {
  const [open, setOpen] = useState(false)
  const [nom, setNom] = useState(template.nom)
  const [contenu, setContenu] = useState(template.contenu)
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState<TemplateActionState, FormData>(
    async (prev, fd) => {
      const next = await updateTemplateAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success("Modèle mis à jour")
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

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setNom(template.nom)
      setContenu(template.contenu)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-9 md:size-7"
            aria-label="Modifier ce modèle"
            title="Modifier"
          >
            <Pencil />
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="id" value={template.id} />
          <DialogHeader>
            <DialogTitle>Modifier le modèle</DialogTitle>
            <DialogDescription>
              Le contenu sera disponible dans le formulaire de création de
              message.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`tpl-edit-nom-${template.id}`}>Nom</Label>
              <Input
                id={`tpl-edit-nom-${template.id}`}
                name="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tpl-edit-contenu-${template.id}`}>Contenu</Label>
              <MessageEditor
                id={`tpl-edit-contenu-${template.id}`}
                name="contenu"
                value={contenu}
                onChange={setContenu}
                rows={6}
                required
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
              disabled={
                isPending ||
                nom.trim().length === 0 ||
                contenu.trim().length === 0
              }
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTemplateButton({ id, nom }: { id: number; nom: string }) {
  const [isPending, startTransition] = useTransition()

  function onClick() {
    if (!confirm(`Supprimer le modèle « ${nom} » ?`)) return
    const fd = new FormData()
    fd.set("id", String(id))
    startTransition(async () => {
      const res = await deleteTemplateAction(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Modèle supprimé")
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive size-9 md:size-7"
      aria-label="Supprimer ce modèle"
      title="Supprimer ce modèle"
    >
      <Trash2 />
    </Button>
  )
}
