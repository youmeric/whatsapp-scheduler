// Personnalisation des messages par destinataire.
// Tokens supportés dans le texte : {nom}, {prenom}, {numero}.
// La substitution se fait à la CRÉATION (une ligne par destinataire dans le
// Google Sheet contient déjà le message personnalisé) → n8n et le bot ne
// voient qu'un message final, aucun changement côté workflow.

import { digitsOnly } from "./phone"

const TOKEN_RE = /\{\s*(nom|prenom|prénom|numero|numéro)\s*\}/gi

/** Vrai si le message contient au moins un token de personnalisation. */
export function hasPersonalizationTokens(message: string): boolean {
  TOKEN_RE.lastIndex = 0
  return TOKEN_RE.test(message)
}

/**
 * Remplace les tokens par les infos du destinataire.
 * - {nom}    → nom complet du contact
 * - {prenom} → premier mot du nom
 * - {numero} → chiffres du numéro
 */
export function personalizeMessage(
  message: string,
  contact: { nom?: string; numero?: string }
): string {
  const nom = (contact.nom ?? "").trim()
  const prenom = nom.split(/\s+/)[0] ?? ""
  const numero = digitsOnly(contact.numero ?? "")
  return message.replace(TOKEN_RE, (_m, tokenRaw: string) => {
    const token = tokenRaw.toLowerCase()
    if (token === "nom") return nom
    if (token === "prenom" || token === "prénom") return prenom
    return numero // numero / numéro
  })
}
