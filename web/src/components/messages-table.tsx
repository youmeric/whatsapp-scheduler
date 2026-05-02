"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Paperclip,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { Recipient, ScheduledMessage } from "@/lib/types"
import { buildRecipientNameByDigits, digitsOnly } from "@/lib/phone"
import {
  bulkDeleteMessagesAction,
  deleteMessageAction,
} from "@/app/(app)/messages/actions"
import { EditMessageDialog } from "@/components/edit-message-dialog"

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})
const dateFormatterShort = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
})

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return dateFormatter.format(new Date(y, m - 1, d))
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return dateFormatterShort.format(new Date(y, m - 1, d))
}

type StatusFilter = "all" | "pending" | "sent"

type CurrentUser = {
  username: string
  role: "super_admin" | "admin" | "user"
}

function isAdminOrAbove(role: CurrentUser["role"]): boolean {
  return role === "admin" || role === "super_admin"
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

function csvEscape(s: string): string {
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function MessagesTable({
  messages,
  recipients,
  currentUser,
}: {
  messages: ScheduledMessage[]
  recipients: Recipient[]
  currentUser: CurrentUser
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const [status, setStatus] = useState<StatusFilter>(
    () => (searchParams.get("status") as StatusFilter) ?? "all"
  )
  const [creator, setCreator] = useState<string>(
    () => searchParams.get("creator") ?? "all"
  )
  const [page, setPage] = useState<number>(() => {
    const p = Number(searchParams.get("page") ?? "1")
    return Number.isFinite(p) && p > 0 ? p : 1
  })
  const [pageSize, setPageSize] = useState<number>(() => {
    const ps = Number(searchParams.get("size") ?? "20")
    return PAGE_SIZE_OPTIONS.includes(ps) ? ps : 20
  })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPending, startBulkTransition] = useTransition()

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (query.trim()) params.set("q", query.trim())
    if (status !== "all") params.set("status", status)
    if (creator !== "all") params.set("creator", creator)
    if (page > 1) params.set("page", String(page))
    if (pageSize !== 20) params.set("size", String(pageSize))
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : "?", { scroll: false })
  }, [query, status, creator, page, pageSize, router])

  useEffect(() => {
    syncUrl()
  }, [syncUrl])

  const nameByDigits = useMemo(
    () => buildRecipientNameByDigits(recipients),
    [recipients]
  )

  const creators = useMemo(() => {
    const set = new Set<string>()
    for (const m of messages) if (m.cree_par) set.add(m.cree_par)
    return Array.from(set).sort()
  }, [messages])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return messages.filter((m) => {
      if (status === "pending" && m.envoye) return false
      if (status === "sent" && !m.envoye) return false
      if (creator !== "all" && m.cree_par !== creator) return false
      if (!q) return true
      const name =
        nameByDigits.get(digitsOnly(m.destinataire))?.toLowerCase() ?? ""
      return (
        name.includes(q) ||
        m.destinataire.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      )
    })
  }, [messages, query, status, creator, nameByDigits])

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.envoye !== b.envoye) return a.envoye ? 1 : -1
        return a.envoye
          ? b.date_envoi.localeCompare(a.date_envoi)
          : a.date_envoi.localeCompare(b.date_envoi)
      }),
    [filtered]
  )

  useEffect(() => {
    setPage(1)
  }, [query, status, creator, pageSize])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const paginated = useMemo(
    () => sorted.slice(pageStart, pageStart + pageSize),
    [sorted, pageStart, pageSize]
  )

  const hasActiveFilter =
    query.trim().length > 0 || status !== "all" || creator !== "all"

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setCreator("all")
  }

  // ---- selection ----
  const selectableIds = useMemo(() => {
    return new Set(
      paginated
        .filter(
          (m) =>
            isAdminOrAbove(currentUser.role) ||
            m.cree_par === currentUser.username
        )
        .map((m) => m.id)
    )
  }, [paginated, currentUser])

  function toggleRow(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function togglePage(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of selectableIds) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const allOnPageSelected =
    selectableIds.size > 0 &&
    Array.from(selectableIds).every((id) => selected.has(id))
  const someOnPageSelected =
    !allOnPageSelected &&
    Array.from(selectableIds).some((id) => selected.has(id))

  function bulkDelete() {
    if (selected.size === 0) return
    if (
      !confirm(
        `Supprimer ${selected.size} message${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""} ?`
      )
    ) {
      return
    }
    const fd = new FormData()
    fd.set("ids", Array.from(selected).join(","))
    startBulkTransition(async () => {
      const res = await bulkDeleteMessagesAction(fd)
      if (res?.error) {
        toast.error(res.error)
      } else {
        const deleted = res?.deleted ?? 0
        const failed = res?.failed ?? 0
        if (failed === 0) {
          toast.success(`${deleted} message${deleted > 1 ? "s" : ""} supprimé${deleted > 1 ? "s" : ""}`)
        } else {
          toast.warning(`${deleted} supprimé(s), ${failed} échec(s).`)
        }
        setSelected(new Set())
      }
    })
  }

  // ---- CSV export ----
  function exportCsv() {
    const headers = [
      "id",
      "date_envoi",
      "heure_envoi",
      "destinataire",
      "destinataire_nom",
      "message",
      "envoye",
      "cree_par",
      "cree_le",
      "attachment_url",
      "attachment_filename",
    ]
    const rows = sorted.map((m) => {
      const matchedName = nameByDigits.get(digitsOnly(m.destinataire)) ?? ""
      return [
        m.id,
        m.date_envoi,
        m.heure_envoi ?? "",
        m.destinataire,
        matchedName,
        m.message,
        m.envoye ? "true" : "false",
        m.cree_par,
        m.cree_le,
        m.attachment_url ?? "",
        m.attachment_filename ?? "",
      ]
        .map((v) => csvEscape(String(v)))
        .join(",")
    })
    const csv = "﻿" + headers.join(",") + "\n" + rows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const today = new Date().toISOString().slice(0, 10)
    a.download = `messages-${today}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar — search full-width on mobile, inline on tablet+ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, numéro, message…)"
            className="pl-8 h-10 sm:h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => setStatus((v ?? "all") as StatusFilter)}
          >
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[140px] h-10 sm:h-9 min-w-[120px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pending">À venir</SelectItem>
              <SelectItem value="sent">Envoyés</SelectItem>
            </SelectContent>
          </Select>

          {creators.length > 1 && (
            <Select
              value={creator}
              onValueChange={(v) => setCreator(v ?? "all")}
            >
              <SelectTrigger className="flex-1 sm:flex-none sm:w-[160px] h-10 sm:h-9 min-w-[140px]">
                <SelectValue placeholder="Créé par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les auteurs</SelectItem>
                {creators.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-10 sm:h-9"
            >
              <X />
              <span className="hidden sm:inline">Réinitialiser</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="h-10 sm:h-9 ml-auto sm:ml-0"
            disabled={sorted.length === 0}
            title="Exporter la vue actuelle au format CSV"
          >
            <Download />
            CSV
          </Button>
        </div>

        <span className="text-xs text-muted-foreground tabular-nums sm:ml-auto">
          {sorted.length} sur {messages.length}
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            className="h-8"
          >
            <X />
            Désélectionner
          </Button>
          <div className="ml-auto">
            <Button
              variant="destructive"
              size="sm"
              onClick={bulkDelete}
              disabled={bulkPending}
              className="h-8"
            >
              <Trash2 />
              {bulkPending ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <CalendarClock className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {messages.length === 0
                ? "Aucun message programmé"
                : "Aucun message ne correspond aux filtres"}
            </p>
            <p className="text-xs text-muted-foreground">
              {messages.length === 0
                ? "Cliquez sur « Nouveau message » pour commencer."
                : "Essaie de modifier ta recherche ou de réinitialiser les filtres."}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Desktop table — hidden on mobile */}
          <Card className="hidden md:block overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={someOnPageSelected}
                      onCheckedChange={(v) => togglePage(Boolean(v))}
                      disabled={selectableIds.size === 0}
                      aria-label="Tout sélectionner"
                    />
                  </TableHead>
                  <TableHead className="w-[140px]">Date d&apos;envoi</TableHead>
                  <TableHead className="w-[80px]">Heure</TableHead>
                  <TableHead className="w-[200px]">Destinataire</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[120px]">Statut</TableHead>
                  <TableHead className="w-[140px]">Créé par</TableHead>
                  <TableHead className="w-[110px] text-right pr-4">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((m) => {
                  const matchedName = nameByDigits.get(
                    digitsOnly(m.destinataire)
                  )
                  const recipientLabel = matchedName ?? digitsOnly(m.destinataire)
                  const canManage =
                    isAdminOrAbove(currentUser.role) ||
                    m.cree_par === currentUser.username
                  const canEdit = canManage && !m.envoye
                  const isChecked = selected.has(m.id)
                  return (
                    <TableRow key={m.id} data-selected={isChecked}>
                      <TableCell>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(v) => toggleRow(m.id, Boolean(v))}
                          disabled={!canManage}
                          aria-label="Sélectionner"
                        />
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatDate(m.date_envoi)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground text-sm">
                        {m.heure_envoi ?? "10:00"}
                      </TableCell>
                      <TableCell>
                        {matchedName ? (
                          <div className="flex flex-col">
                            <span>{matchedName}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {digitsOnly(m.destinataire)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-sm">
                            {m.destinataire}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[420px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          {m.attachment_url ? (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-foreground hover:text-primary shrink-0"
                              title={
                                m.attachment_filename ?? "Pièce jointe"
                              }
                              aria-label="Ouvrir la pièce jointe"
                            >
                              <Paperclip className="size-3.5" />
                            </a>
                          ) : null}
                          <span className="truncate">{m.message}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.envoye ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="size-3" />
                            Envoyé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <CalendarClock className="size-3" />
                            À venir
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.cree_par}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {canManage ? (
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <EditMessageDialog
                                message={m}
                                recipients={recipients}
                              />
                            )}
                            <DeleteMessageButton
                              id={m.id}
                              recipientLabel={recipientLabel}
                              formattedDate={formatDate(m.date_envoi)}
                            />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards — hidden on tablet+ */}
          <div className="md:hidden flex flex-col gap-2">
            {paginated.map((m) => {
              const matchedName = nameByDigits.get(
                digitsOnly(m.destinataire)
              )
              const recipientLabel =
                matchedName ?? digitsOnly(m.destinataire)
              const canManage =
                isAdminOrAbove(currentUser.role) ||
                m.cree_par === currentUser.username
              const canEdit = canManage && !m.envoye
              const isChecked = selected.has(m.id)
              return (
                <Card
                  key={m.id}
                  className="p-3 gap-2 data-[selected=true]:ring-2 data-[selected=true]:ring-primary/40"
                  data-selected={isChecked}
                >
                  {/* Top row: checkbox + date/time + status */}
                  <div className="flex items-start gap-2">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => toggleRow(m.id, Boolean(v))}
                        disabled={!canManage}
                        aria-label="Sélectionner"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 text-sm font-medium tabular-nums">
                          <span className="capitalize">
                            {formatDateShort(m.date_envoi)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            · {m.heure_envoi ?? "10:00"}
                          </span>
                        </div>
                        {m.envoye ? (
                          <Badge variant="secondary" className="gap-1 shrink-0">
                            <Check className="size-3" />
                            Envoyé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 shrink-0">
                            <CalendarClock className="size-3" />À venir
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="pl-6">
                    {matchedName ? (
                      <>
                        <div className="text-sm font-medium">{matchedName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {digitsOnly(m.destinataire)}
                        </div>
                      </>
                    ) : (
                      <div className="font-mono text-sm">{m.destinataire}</div>
                    )}
                  </div>

                  {/* Message */}
                  <div className="pl-6 text-sm text-muted-foreground line-clamp-3">
                    {m.message}
                  </div>

                  {/* Attachment */}
                  {m.attachment_url ? (
                    <div className="pl-6">
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground hover:text-primary"
                      >
                        <Paperclip className="size-3.5" />
                        <span className="truncate max-w-[200px]">
                          {m.attachment_filename ?? "Pièce jointe"}
                        </span>
                      </a>
                    </div>
                  ) : null}

                  {/* Bottom row: author + actions */}
                  <div className="flex items-center justify-between gap-2 pl-6 pt-1">
                    <span className="text-xs text-muted-foreground">
                      par {m.cree_par}
                    </span>
                    {canManage ? (
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <EditMessageDialog
                            message={m}
                            recipients={recipients}
                          />
                        )}
                        <DeleteMessageButton
                          id={m.id}
                          recipientLabel={recipientLabel}
                          formattedDate={formatDate(m.date_envoi)}
                        />
                      </div>
                    ) : null}
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Lignes par page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v ?? "20"))}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-xs text-muted-foreground tabular-nums">
                {pageStart + 1}–{Math.min(pageStart + pageSize, sorted.length)}{" "}
                / {sorted.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Page précédente"
                className="size-9"
              >
                <ChevronLeft />
              </Button>
              <span className="text-xs tabular-nums px-1 min-w-[40px] text-center">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Page suivante"
                className="size-9"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DeleteMessageButton({
  id,
  recipientLabel,
  formattedDate,
}: {
  id: string
  recipientLabel: string
  formattedDate: string
}) {
  const [isPending, startTransition] = useTransition()

  function onClick() {
    if (
      !confirm(
        `Supprimer le message du ${formattedDate} pour ${recipientLabel} ?`
      )
    ) {
      return
    }
    const fd = new FormData()
    fd.set("id", id)
    startTransition(async () => {
      const res = await deleteMessageAction(fd)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("Message supprimé")
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive size-9 md:size-7"
      aria-label="Supprimer ce message"
      title="Supprimer ce message"
    >
      <Trash2 />
    </Button>
  )
}
