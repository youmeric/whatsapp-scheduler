// Datetime helpers.
//
// Goal: store timestamps that are READ DIRECTLY from a Google Sheet cell or
// from SQLite must be Europe/Paris time, since the user (and n8n, and the
// bot) all live in that timezone.
//
// `new Date().toISOString()` always returns UTC ("…Z") which makes the sheet
// show e.g. 08:30 instead of 10:30. Since the Docker container forces
// `TZ=Europe/Paris`, JS `Date` getter methods (getHours / getMinutes / …)
// already return Paris-local values — we just have to assemble them into a
// readable string.

/**
 * Returns the current local datetime as "YYYY-MM-DD HH:MM:SS".
 * In Docker (TZ=Europe/Paris) this is Paris time.
 */
export function nowLocalDateTime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  )
}
