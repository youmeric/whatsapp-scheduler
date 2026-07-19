"use client"

import { useActionState, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction, type LoginState } from "./actions"

export function LoginForm({ from }: { from: string }) {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  )
  const [redirecting, setRedirecting] = useState(false)

  // On success, do a full-page navigation so the browser sends the freshly-set
  // session cookie on the request the proxy validates. A client-side router
  // push would race the cookie and fail to load on the first attempt.
  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      setRedirecting(true)
      window.location.href = state.redirectTo
    }
  }, [state])

  const error = state && "error" in state ? state.error : undefined
  const busy = isPending || redirecting

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="from" value={from} />
          <div className="space-y-2">
            <Label htmlFor="username">Identifiant</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={busy}
          >
            {busy ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
