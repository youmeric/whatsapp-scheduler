// SQLite database singleton.
// File path can be customized via DATABASE_PATH env var (used in Docker).
// Default: <cwd>/data/app.db

import Database from "better-sqlite3"
import { existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { nowLocalDateTime } from "./datetime"

let _db: Database.Database | null = null

export type Role = "super_admin" | "admin" | "user"

export const ROLES: readonly Role[] = ["super_admin", "admin", "user"] as const

export function isAdminOrAbove(role: Role): boolean {
  return role === "admin" || role === "super_admin"
}

export type DbUser = {
  id: number
  username: string
  password_hash: string
  role: Role
  created_at: string
}

function resolveDbPath(): string {
  const p = process.env.DATABASE_PATH?.trim()
  if (p && p.length > 0) return resolve(p)
  return resolve(process.cwd(), "data", "app.db")
}

function migrate(db: Database.Database): void {
  // ---------- users table ----------
  const tableRow = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    )
    .get() as { sql: string } | undefined

  if (!tableRow) {
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user','admin','super_admin')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
  } else if (!tableRow.sql.includes("super_admin")) {
    // Old schema: recreate with new CHECK constraint.
    db.exec("BEGIN TRANSACTION")
    try {
      db.exec(`
        ALTER TABLE users RENAME TO _users_old;
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user','admin','super_admin')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users (id, username, password_hash, role, created_at)
          SELECT id, username, password_hash, role, created_at FROM _users_old;
        DROP TABLE _users_old;
      `)
      db.exec("COMMIT")
      console.log("[db] migrated users table to support super_admin role")
    } catch (err) {
      db.exec("ROLLBACK")
      throw err
    }
  }

  // ---------- templates table ----------
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      contenu TEXT NOT NULL,
      cree_par TEXT NOT NULL,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_templates_nom ON templates(nom COLLATE NOCASE);
  `)

  // ---------- audit_log table ----------
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_log(username);
  `)
}

function bootstrap(db: Database.Database): void {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM users")
    .get() as { n: number }

  if (row.n === 0) {
    // Fresh — create the very first user as super_admin.
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim()
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
    if (!username || !password) {
      console.warn(
        "[db] users table empty and BOOTSTRAP_ADMIN_USERNAME/PASSWORD not set. Set them in .env.local for first launch."
      )
      return
    }
    const hash = hashPasswordSync(password)
    db.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'super_admin')"
    ).run(username, hash)
    console.log(`[db] bootstrapped first super-admin: ${username}`)
    return
  }

  // Existing users — if no super_admin yet, promote the bootstrap admin
  // (this handles upgrading from the v1 schema where the 1st user was 'admin').
  const superAdminCount = (db
    .prepare(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'"
    )
    .get() as { n: number }).n

  if (superAdminCount === 0) {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim()
    if (username) {
      const result = db
        .prepare(
          "UPDATE users SET role = 'super_admin' WHERE username = ? COLLATE NOCASE AND role IN ('admin','user')"
        )
        .run(username)
      if (result.changes > 0) {
        console.log(`[db] promoted ${username} to super_admin`)
      } else {
        console.warn(
          "[db] no super_admin found and BOOTSTRAP_ADMIN_USERNAME does not match an existing user. Promote one manually."
        )
      }
    }
  }
}

export function getDb(): Database.Database {
  if (_db) return _db
  const path = resolveDbPath()
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const db = new Database(path)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  migrate(db)
  bootstrap(db)
  _db = db
  return db
}

// ---------- password hashing (scrypt, no external dep) ----------
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto"

const SCRYPT_N = 16384 // CPU cost
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64
const SALT_LEN = 16

function hashPasswordSync(password: string): string {
  const salt = randomBytes(SALT_LEN)
  const derived = scryptSync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`
}

export function hashPassword(password: string): string {
  return hashPasswordSync(password)
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], "hex")
  const expected = Buffer.from(parts[5], "hex")
  try {
    const derived = scryptSync(password, salt, expected.length, { N, r, p })
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

// ---------- user queries ----------

export function findUserByUsername(username: string): DbUser | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(username) as DbUser | undefined
  return row ?? null
}

export function findUserById(id: number): DbUser | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as DbUser | undefined
  return row ?? null
}

export function listUsers(): DbUser[] {
  return getDb()
    .prepare("SELECT * FROM users ORDER BY username COLLATE NOCASE ASC")
    .all() as DbUser[]
}

export function createUser(
  username: string,
  password: string,
  role: Role
): { ok: true; id: number } | { ok: false; error: string } {
  const u = username.trim()
  if (!u) return { ok: false, error: "Username vide" }
  if (password.length < 4)
    return { ok: false, error: "Mot de passe trop court (min 4 caractères)" }
  if (!ROLES.includes(role)) return { ok: false, error: "Rôle invalide" }
  try {
    const hash = hashPassword(password)
    const info = getDb()
      .prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
      )
      .run(u, hash, role)
    return { ok: true, id: Number(info.lastInsertRowid) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("UNIQUE")) {
      return { ok: false, error: "Cet identifiant existe déjà" }
    }
    return { ok: false, error: msg }
  }
}

export function updateUser(
  id: number,
  changes: { password?: string; role?: Role }
): { ok: true } | { ok: false; error: string } {
  const setClauses: string[] = []
  const params: unknown[] = []

  if (changes.password !== undefined) {
    if (changes.password.length < 4) {
      return {
        ok: false,
        error: "Mot de passe trop court (min 4 caractères)",
      }
    }
    setClauses.push("password_hash = ?")
    params.push(hashPassword(changes.password))
  }
  if (changes.role !== undefined) {
    if (!ROLES.includes(changes.role)) {
      return { ok: false, error: "Rôle invalide" }
    }
    setClauses.push("role = ?")
    params.push(changes.role)
  }

  if (setClauses.length === 0) return { ok: true }

  params.push(id)
  const info = getDb()
    .prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`)
    .run(...(params as never[]))

  if (info.changes === 0) return { ok: false, error: "Utilisateur introuvable" }
  return { ok: true }
}

export function deleteUser(
  id: number
): { ok: true } | { ok: false; error: string } {
  const info = getDb().prepare("DELETE FROM users WHERE id = ?").run(id)
  if (info.changes === 0) return { ok: false, error: "Utilisateur introuvable" }
  return { ok: true }
}

export function countByRole(role: Role): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?")
    .get(role) as { n: number }
  return row.n
}

export function updateOwnPassword(
  id: number,
  currentPassword: string,
  newPassword: string
): { ok: true } | { ok: false; error: string } {
  if (newPassword.length < 4) {
    return { ok: false, error: "Mot de passe trop court (min 4 caractères)" }
  }
  const u = findUserById(id)
  if (!u) return { ok: false, error: "Utilisateur introuvable" }
  if (!verifyPassword(currentPassword, u.password_hash)) {
    return { ok: false, error: "Mot de passe actuel incorrect" }
  }
  const hash = hashPassword(newPassword)
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(hash, id)
  return { ok: true }
}

// ---------- templates ----------

export type DbTemplate = {
  id: number
  nom: string
  contenu: string
  cree_par: string
  cree_le: string
}

export function listTemplates(): DbTemplate[] {
  return getDb()
    .prepare("SELECT * FROM templates ORDER BY nom COLLATE NOCASE ASC")
    .all() as DbTemplate[]
}

export function findTemplateById(id: number): DbTemplate | null {
  const row = getDb()
    .prepare("SELECT * FROM templates WHERE id = ?")
    .get(id) as DbTemplate | undefined
  return row ?? null
}

export function createTemplate(
  nom: string,
  contenu: string,
  cree_par: string
): { ok: true; id: number } | { ok: false; error: string } {
  const n = nom.trim()
  const c = contenu.trim()
  if (!n) return { ok: false, error: "Le nom du modèle est requis" }
  if (n.length > 60) return { ok: false, error: "Nom trop long (max 60 caractères)" }
  if (!c) return { ok: false, error: "Le contenu du modèle est requis" }
  if (c.length > 1500) return { ok: false, error: "Contenu trop long (max 1500 caractères)" }
  // Pass cree_le explicitly (Paris-local time) — the SQLite default
  // CURRENT_TIMESTAMP is always UTC.
  const info = getDb()
    .prepare(
      "INSERT INTO templates (nom, contenu, cree_par, cree_le) VALUES (?, ?, ?, ?)"
    )
    .run(n, c, cree_par, nowLocalDateTime())
  return { ok: true, id: Number(info.lastInsertRowid) }
}

export function updateTemplate(
  id: number,
  changes: { nom?: string; contenu?: string }
): { ok: true } | { ok: false; error: string } {
  const setClauses: string[] = []
  const params: unknown[] = []

  if (changes.nom !== undefined) {
    const n = changes.nom.trim()
    if (!n) return { ok: false, error: "Nom requis" }
    if (n.length > 60) return { ok: false, error: "Nom trop long" }
    setClauses.push("nom = ?")
    params.push(n)
  }
  if (changes.contenu !== undefined) {
    const c = changes.contenu.trim()
    if (!c) return { ok: false, error: "Contenu requis" }
    if (c.length > 1500) return { ok: false, error: "Contenu trop long" }
    setClauses.push("contenu = ?")
    params.push(c)
  }
  if (setClauses.length === 0) return { ok: true }
  params.push(id)
  const info = getDb()
    .prepare(`UPDATE templates SET ${setClauses.join(", ")} WHERE id = ?`)
    .run(...(params as never[]))
  if (info.changes === 0) return { ok: false, error: "Modèle introuvable" }
  return { ok: true }
}

export function deleteTemplate(
  id: number
): { ok: true } | { ok: false; error: string } {
  const info = getDb().prepare("DELETE FROM templates WHERE id = ?").run(id)
  if (info.changes === 0) return { ok: false, error: "Modèle introuvable" }
  return { ok: true }
}

// ---------- audit log ----------

export type DbAuditLog = {
  id: number
  username: string
  action: string
  target: string | null
  details: string | null
  created_at: string
}

export function addAuditLog(entry: {
  username: string
  action: string
  target?: string | null
  details?: Record<string, unknown> | string | null
}): void {
  let detailsStr: string | null = null
  if (entry.details !== undefined && entry.details !== null) {
    detailsStr =
      typeof entry.details === "string"
        ? entry.details
        : JSON.stringify(entry.details)
  }
  // Pass created_at explicitly (Paris-local). SQLite default CURRENT_TIMESTAMP
  // is UTC, which is confusing for users browsing the audit log.
  getDb()
    .prepare(
      "INSERT INTO audit_log (username, action, target, details, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      entry.username,
      entry.action,
      entry.target ?? null,
      detailsStr,
      nowLocalDateTime()
    )
}

export function listAuditLogs(opts?: {
  limit?: number
  offset?: number
  username?: string
  action?: string
}): { rows: DbAuditLog[]; total: number } {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500)
  const offset = Math.max(opts?.offset ?? 0, 0)

  const filters: string[] = []
  const params: unknown[] = []
  if (opts?.username) {
    filters.push("username = ?")
    params.push(opts.username)
  }
  if (opts?.action) {
    filters.push("action = ?")
    params.push(opts.action)
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""

  const total = (getDb()
    .prepare(`SELECT COUNT(*) AS n FROM audit_log ${where}`)
    .get(...(params as never[])) as { n: number }).n

  const rows = getDb()
    .prepare(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...(params as never[]), limit, offset) as DbAuditLog[]

  return { rows, total }
}

/**
 * Prune old audit log rows to prevent unlimited growth.
 * Default: keep the most recent 5000 entries.
 */
export function pruneAuditLog(keep = 5000): number {
  const info = getDb()
    .prepare(
      `DELETE FROM audit_log
       WHERE id NOT IN (
         SELECT id FROM audit_log ORDER BY created_at DESC LIMIT ?
       )`
    )
    .run(keep)
  return info.changes
}
