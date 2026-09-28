// Liveness probe for process supervisors and uptime checks. Kept dependency-free
// so it answers even when the database is unreachable.
export function GET() {
  return Response.json({ ok: true })
}
