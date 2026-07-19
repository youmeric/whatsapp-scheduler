// Phone-number helpers.
// The two sheets use different formats:
//   - Feuille 1 (messages): "33650601057"            (raw digits, no '+', no '@c.us')
//   - Feuille 2 (recipients): "33780353168@c.us"     (digits + WhatsApp '@c.us' suffix)
// We normalize to digits-only for matching.

export function digitsOnly(phone: string | undefined | null): string {
  if (!phone) return ""
  return String(phone).replace(/\D/g, "")
}

/** WhatsApp chat-id format expected by wppconnect / by your existing 10am send workflow. */
export function toWhatsappAddress(phone: string | undefined | null): string {
  const d = digitsOnly(phone)
  return d ? `${d}@c.us` : ""
}

import type { Recipient } from "./types"

/**
 * Build a lookup `digits -> nom` so we can show recipient names in the
 * messages table even though the sheet stores phone numbers.
 */
export function buildRecipientNameByDigits(
  recipients: Recipient[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of recipients) {
    const key = digitsOnly(r.numero)
    if (key) map.set(key, r.nom)
  }
  return map
}

/**
 * Human label for a stored destinataire ("<digits>@c.us"): the matching
 * recipient's name if it's still in the carnet, otherwise the bare digits.
 * Used to show names instead of raw numbers in the destinataire selects.
 */
export function labelForAddress(
  address: string,
  recipients: Recipient[]
): string {
  const digits = digitsOnly(address)
  const match = recipients.find((r) => digitsOnly(r.numero) === digits)
  return match ? match.nom : digits
}
