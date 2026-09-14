// Personnalisation des messages, appliquée à la CRÉATION (une ligne = message
// déjà final dans le Google Sheet → aucun changement n8n/bot).
//
// Tokens destinataire : {nom}, {prenom}, {numero}
// Tokens de date (basés sur la date d'envoi de la ligne) :
//   {date}       → 14/09/2026
//   {date+N}     → date d'envoi + N jours (ex. {date+6})
//   {jour}       → lundi
//   {semaine}    → Du 14/09/2026 au 20/09/2026  (date → date+6)

import { digitsOnly } from "./phone"

const CONTACT_RE = /\{\s*(nom|prenom|prénom|numero|numéro)\s*\}/gi
const DATE_RE = /\{\s*date\s*\}/gi
const DATE_PLUS_RE = /\{\s*date\s*\+\s*(\d{1,3})\s*\}/gi
const JOUR_RE = /\{\s*jour\s*\}/gi
const SEMAINE_RE = /\{\s*semaine\s*\}/gi

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})
const jourFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long" })

function parseIso(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/** Contient un token destinataire ({nom}/{prenom}/{numero}). */
export function hasContactTokens(message: string): boolean {
  CONTACT_RE.lastIndex = 0
  return CONTACT_RE.test(message)
}

/** Contient au moins un token quelconque (contact ou date). */
export function hasPersonalizationTokens(message: string): boolean {
  return (
    hasContactTokens(message) ||
    /\{\s*date(\s*\+\s*\d{1,3})?\s*\}/i.test(message) ||
    JOUR_RE.test(message) ||
    SEMAINE_RE.test(message)
  )
}

export function personalizeMessage(
  message: string,
  ctx: { nom?: string; numero?: string; date?: string }
): string {
  const nom = (ctx.nom ?? "").trim()
  const prenom = nom.split(/\s+/)[0] ?? ""
  const numero = digitsOnly(ctx.numero ?? "")
  const base = ctx.date ? parseIso(ctx.date) : null

  let out = message
    .replace(CONTACT_RE, (_m, tokenRaw: string) => {
      const t = tokenRaw.toLowerCase()
      if (t === "nom") return nom
      if (t === "prenom" || t === "prénom") return prenom
      return numero
    })

  if (base) {
    out = out
      .replace(SEMAINE_RE, () => {
        return `Du ${dateFmt.format(base)} au ${dateFmt.format(addDays(base, 6))}`
      })
      .replace(DATE_PLUS_RE, (_m, nStr: string) => {
        const n = Number(nStr)
        return dateFmt.format(addDays(base, Number.isFinite(n) ? n : 0))
      })
      .replace(DATE_RE, () => dateFmt.format(base))
      .replace(JOUR_RE, () => jourFmt.format(base))
  }

  return out
}
