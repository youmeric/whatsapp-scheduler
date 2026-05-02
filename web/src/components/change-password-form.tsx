"use client"

import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/(app)/profile/actions"

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isPending, startTransition] = useTransition()

  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    async (prev, fd) => {
      const r = await changePasswordAction(prev, fd)
      if (r?.error) {
        toast.error(r.error)
      } else if (r?.ok) {
        toast.success("Mot de passe mis à jour")
        setCurrent("")
        setNext("")
        setConfirm("")
      }
      return r
    },
    null
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => formAction(fd))
  }

  const canSubmit =
    current.length > 0 &&
    next.length >= 4 &&
    confirm.length >= 4 &&
    next === confirm

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="current_password">Mot de passe actuel</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new_password">Nouveau mot de passe</Label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={4}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={4}
        />
        {confirm.length > 0 && next !== confirm ? (
          <p className="text-xs text-destructive">Les mots de passe ne correspondent pas.</p>
        ) : null}
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit || isPending}>
          {isPending ? "Enregistrement…" : "Mettre à jour"}
        </Button>
      </div>
    </form>
  )
}
