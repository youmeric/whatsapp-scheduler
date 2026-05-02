// Thin wrapper around db.addAuditLog so server actions can log events
// without importing the SQLite layer directly. Failure to log MUST NEVER
// fail the surrounding action — log to stderr instead.

import { addAuditLog } from "./db"

export type AuditAction =
  | "create_message"
  | "update_message"
  | "delete_message"
  | "bulk_delete_message"
  | "create_recipient"
  | "delete_recipient"
  | "create_template"
  | "update_template"
  | "delete_template"
  | "create_user"
  | "update_user"
  | "delete_user"
  | "change_password"

export function logAudit(entry: {
  username: string
  action: AuditAction
  target?: string | null
  details?: Record<string, unknown> | null
}): void {
  try {
    addAuditLog(entry)
  } catch (err) {
    console.error("[audit] failed to log:", err)
  }
}
