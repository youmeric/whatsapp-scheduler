// Domain types for the WhatsApp scheduler

export type ScheduledMessage = {
  id: string
  date_envoi: string // ISO date "YYYY-MM-DD"
  /**
   * Optional send-time as "HH:MM" (24h). Defaults to "10:00" when omitted.
   * Requires a `heure_envoi` column in the Google Sheet AND an updated n8n
   * workflow that compares the column to the current time. If the column is
   * missing, n8n will simply ignore this field and keep sending at 10am.
   */
  heure_envoi?: string
  destinataire: string // recipient name (matched against recipients list)
  message: string
  envoye: boolean
  cree_par: string // username
  cree_le: string // datetime "YYYY-MM-DD HH:MM:SS" (Europe/Paris)
  /**
   * Optional attachment. Stored as a full URL pointing to /api/files/<uuid>.<ext>
   * on this site. n8n must fetch this URL and forward it to the bot, which
   * uses wppconnect's sendFile / sendImage to attach the media to the message.
   * Both columns must exist in the Google Sheet for the field to round-trip.
   */
  attachment_url?: string
  attachment_filename?: string
}

export type Recipient = {
  nom: string
  numero: string // phone number in international format
}

/**
 * Template du message — stocké en SQLite côté site, indépendant de Google Sheet.
 * Permet de sauvegarder des messages réutilisables (rappels, anniversaires, …).
 */
export type Template = {
  id: number
  nom: string
  contenu: string
  cree_par: string
  cree_le: string
}

/**
 * Entrée du journal d'audit. Tracée à chaque création / modification /
 * suppression de message ou utilisateur.
 */
export type AuditLog = {
  id: number
  username: string
  action: string
  target: string | null
  details: string | null
  created_at: string
}

// SessionUser type is defined in lib/auth.ts (with role).
