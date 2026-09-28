import type { Endpoint } from 'payload'
import { endpoint, fail, json } from '../lib/respond'
import { rateLimit } from '../lib/rateLimit'
import { cleanText } from '../lib/text'


const CONTRIBUTION_KINDS = [
  { value: 'question', label: 'Question' },
  { value: 'concern', label: 'Concern' },
  { value: 'comment', label: 'Comment' },
  { value: 'feature', label: 'New feature' },
]
const CONTRIBUTION_SECTIONS = [
  { value: 'general', label: 'Whole consultation' },
  { value: 'open', label: 'Open' },
  { value: 'aims', label: 'Aims' },
  { value: 'need', label: 'Need' },
  { value: 'security', label: 'Security' },
  { value: 'concerns', label: 'Concerns' },
  { value: 'uses', label: 'Features' },
  { value: 'serve', label: 'Who it serves' },
  { value: 'safeguards', label: 'Safeguards' },
  { value: 'agree', label: 'Agree' },
  { value: 'next', label: 'Next steps' },
]

const consultationLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  scope: 'consultation',
})

export const consultationEndpoints: Endpoint[] = [
  {
    path: '/consultation/kinds',
    method: 'get',
    handler: endpoint(async () =>
      json(
        { kinds: CONTRIBUTION_KINDS, sections: CONTRIBUTION_SECTIONS },
        { headers: { 'Cache-Control': 'no-store' } },
      ),
    ),
  },
  {
    path: '/consultation/contributions',
    method: 'get',
    handler: endpoint(async (req) => {
      const where: any = {}
      if (req.query?.kind) where.kind = { equals: req.query.kind }
      if (req.query?.section) where.section = { equals: req.query.section }
      const { docs } = await req.payload.find({
        collection: 'consultation-contributions',
        where,
        sort: 'createdAt',
        limit: Math.min(300, Number(req.query?.limit || 100)),
        overrideAccess: true,
      })
      return json(
        {
          items: (docs as any[]).map((row) => ({
            id: row.id,
            kind: row.kind,
            body: row.body,
            name: row.displayName || null,
            section: row.section,
            createdAt: row.createdAt,
          })),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }),
  },
  {
    path: '/consultation/contributions',
    method: 'post',
    handler: endpoint(async (req) => {
      consultationLimit(req)
      const b = ((await req.json?.()) || {}) as any
      if (b.website) return json({ ok: true, item: null }, { status: 201 })
      const kind = String(b.kind || '')
      if (!CONTRIBUTION_KINDS.some((k) => k.value === kind))
        throw fail.validation({ kind: 'Choose question, concern, comment, or new feature.' })
      const body = cleanText(b.body, 800)
      if (body.length < 8)
        throw fail.validation({
          body: 'Write at least a short sentence so the room can use it.',
        })
      const section = CONTRIBUTION_SECTIONS.some((s) => s.value === b.section)
        ? b.section
        : 'general'
      const item = await req.payload.create({
        collection: 'consultation-contributions',
        data: {
          kind,
          body,
          displayName: cleanText(b.name, 80) || null,
          section,
        } as any,
        overrideAccess: true,
        req,
      })
      return json(
        {
          ok: true,
          item: {
            id: item.id,
            kind,
            body,
            name: cleanText(b.name, 80) || null,
            section,
            createdAt: (item as any).createdAt,
          },
        },
        { status: 201 },
      )
    }),
  },
]
