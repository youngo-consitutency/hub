import type { Endpoint } from 'payload'
import { endpoint, fail, json, readBody } from '../lib/respond'
import { rateLimit } from '../lib/rateLimit'
import { cleanText } from '../lib/text'
import { getDocument } from '../lib/documents'
import type { Doc, DocData } from '../lib/domain'

// The questionnaire structure (kinds + sections) is console-editable content
// in the `consultation` document; the API both serves and validates with it.
async function consultationOptions(req: any) {
  const body = (await getDocument(req, 'consultation'))?.body || {}
  return {
    kinds: Array.isArray(body.kinds) ? body.kinds : [],
    sections: Array.isArray(body.sections) ? body.sections : [],
  }
}

const consultationLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  scope: 'consultation',
})

export const consultationEndpoints: Endpoint[] = [
  {
    path: '/consultation/kinds',
    method: 'get',
    handler: endpoint(async (req) =>
      json(await consultationOptions(req), {
        headers: { 'Cache-Control': 'no-store' },
      }),
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
          items: (docs as Doc[]).map((row) => ({
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
      await consultationLimit(req)
      const b = await readBody(req)
      if (b.website) return json({ ok: true, item: null }, { status: 201 })
      const { kinds, sections } = await consultationOptions(req)
      const kind = String(b.kind || '')
      if (!kinds.some((k: any) => k.value === kind))
        throw fail.validation({ kind: 'Choose a contribution type.' })
      const body = cleanText(b.body, 800)
      if (body.length < 8)
        throw fail.validation({
          body: 'Write at least a short sentence so the room can use it.',
        })
      const section = sections.some((s: any) => s.value === b.section)
        ? b.section
        : sections[0]?.value || null
      const item = await req.payload.create({
        collection: 'consultation-contributions',
        data: {
          kind,
          body,
          displayName: cleanText(b.name, 80) || null,
          section,
        } as DocData,
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
            createdAt: (item as Doc).createdAt,
          },
        },
        { status: 201 },
      )
    }),
  },
]
