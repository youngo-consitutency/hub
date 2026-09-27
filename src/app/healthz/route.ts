// Liveness probe for Railway and other process supervisors. Kept dependency-free
// so it answers even when the database is unreachable.
export function GET() {
  return Response.json({ ok: true })
}
