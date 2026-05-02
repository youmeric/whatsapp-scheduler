import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChangePasswordForm } from "@/components/change-password-form"

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const roleLabel =
    session.role === "super_admin"
      ? "Super administrateur"
      : session.role === "admin"
        ? "Administrateur"
        : "Utilisateur"

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="text-sm text-muted-foreground">
          Gère ton compte et ton mot de passe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Identifiant</span>
            <span className="font-medium">{session.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rôle</span>
            <span className="font-medium">{roleLabel}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer mon mot de passe</CardTitle>
          <CardDescription>
            Saisis ton mot de passe actuel pour confirmer ton identité.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
