import type { PayloadRequest } from 'payload'

// Single audit-trail writer. Everything records actor, actorEmail, and the
// inbound request id; callers supply action/target fields via entry.
export async function audit(
  req: PayloadRequest,
  actor: any,
  entry: Record<string, any>,
) {
  await req.payload.create({
    collection: 'audit-log',
    data: {
      actor: actor?.id,
      actorEmail: actor?.email,
      requestId: (req.headers.get('x-request-id') as string) || null,
      ...entry,
    } as any,
    overrideAccess: true,
    req,
  })
}
