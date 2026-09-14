"use client"

import { useActionState, useState, useTransition } from "react"
import { BookmarkPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import {
  createTemplateAction,
  type TemplateActionState,
} from "@/app/(app)/templates/actions"

/** Bouton qui enregistre le contenu d'un message existant comme modèle réutilisable. */
export function SaveTemplateButton({ message }: { message: string }) {
  const [open, setOpen] = useState(false)
  const [nom, setNom] = useState("")
  const [contenu, setContenu] = useState(message)
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState<TemplateActionState, FormData>(
    async (prev, fd) => {
      const next = await createTemplateAction(prev, fd)
      if (next?.error) {
        toast.error(next.error)
      } else if (next?.ok) {
        toast.success("Modèle enregistré")
        setOpen(false)
      }
      return next
    },
    null
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setNom("")
      setContenu(message)
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
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-9 md:size-7"
            aria-label="Enregistrer comme modèle"
            title="Enregistrer comme modèle"
          >
            <BookmarkPlus />
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enregistrer comme modèle</DialogTitle>
            <DialogDescription>
              Réutilise ce message plus tard depuis le formulaire de création.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-save-nom">Nom du modèle</Label>
              <Input
                id="tpl-save-nom"
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
              <Label htmlFor="tpl-save-contenu">Contenu</Label>
              <Textarea
                id="tpl-save-contenu"
                name="contenu"
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                rows={5}
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
                isPending || nom.trim().length === 0 || contenu.trim().length === 0
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
