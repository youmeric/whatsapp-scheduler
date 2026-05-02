"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import type { AuditLog } from "@/lib/types"

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateFormatter.format(d)
}

const ACTION_LABELS: Record<string, string> = {
  create_message: "Création message",
  update_message: "Modification message",
  delete_message: "Suppression message",
  bulk_delete_message: "Suppression groupée",
  create_recipient: "Création destinataire",
  delete_recipient: "Suppression destinataire",
  create_template: "Création modèle",
  update_template: "Modification modèle",
  delete_template: "Suppression modèle",
  create_user: "Création utilisateur",
  update_user: "Modification utilisateur",
  delete_user: "Suppression utilisateur",
  change_password: "Changement mot de passe",
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export function AuditLogTable({ entries }: { entries: AuditLog[] }) {
  const [query, setQuery] = useState("")
  const [action, setAction] = useState<string>("all")
  const [user, setUser] = useState<string>("all")

  const actions = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) set.add(e.action)
    return Array.from(set).sort()
  }, [entries])

  const users = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) set.add(e.username)
    return Array.from(set).sort()
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (action !== "all" && e.action !== action) return false
      if (user !== "all" && e.username !== user) return false
      if (!q) return true
      return (
        e.username.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.target?.toLowerCase().includes(q) ?? false) ||
        (e.details?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [entries, query, action, user])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (utilisateur, cible, détails…)"
            className="pl-8 h-10 sm:h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={action} onValueChange={(v) => setAction(v ?? "all")}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[180px] h-10 sm:h-9 min-w-[140px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {actionLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {users.length > 1 && (
            <Select value={user} onValueChange={(v) => setUser(v ?? "all")}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-[160px] h-10 sm:h-9 min-w-[120px]">
                <SelectValue placeholder="Utilisateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <span className="text-xs text-muted-foreground tabular-nums sm:ml-auto">
          {filtered.length} sur {entries.length}
        </span>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Date</TableHead>
              <TableHead className="w-[140px]">Utilisateur</TableHead>
              <TableHead className="w-[200px]">Action</TableHead>
              <TableHead className="w-[140px]">Cible</TableHead>
              <TableHead>Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground text-sm"
                >
                  Aucune entrée à afficher.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums text-muted-foreground text-sm">
                    {formatDate(e.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{e.username}</TableCell>
                  <TableCell>{actionLabel(e.action)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.target ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[420px] truncate">
                    {e.details ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <Card className="py-12 text-center text-sm text-muted-foreground">
            Aucune entrée à afficher.
          </Card>
        ) : (
          filtered.map((e) => (
            <Card key={e.id} className="p-3 gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-sm">{e.username}</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatDate(e.created_at)}
                </span>
              </div>
              <div className="text-sm">{actionLabel(e.action)}</div>
              {e.target ? (
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {e.target}
                </div>
              ) : null}
              {e.details ? (
                <div className="text-xs text-muted-foreground line-clamp-2 break-all">
                  {e.details}
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
