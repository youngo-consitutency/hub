import type { AnyValue, Doc } from '../../src/lib/domain'
import { beforeAll, describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import { applyAccountSpec } from '../../scripts/lib/accountSpec'
import { testPayload } from './provision'
import { api, session } from './helpers'

const tag = Math.random().toString(36).slice(2, 8)
const FOCAL_ROLE = `Focal point ${tag}`
const WG_ROLE = `Group ${tag} contact point`

// holders come from authority records under the same rules as permissions
describe('directory role holders', () => {
  let member: { cookie: string; account: Doc }
  const active = `Active Focal ${tag}`
  const lapsed = `Lapsed Focal ${tag}`
  const contact = `Group Contact ${tag}`

  beforeAll(async () => {
    const payload = await testPayload()
    const wg = await payload.create({
      collection: 'working-groups',
      data: { slug: `roles-${tag}`, name: `Roles group ${tag}`, isActive: true } as AnyValue,
      overrideAccess: true,
    })
    for (const [roleTitle, extra] of [
      [FOCAL_ROLE, { role: 'focal_point', scopeId: 'platform' }],
      [WG_ROLE, { wg: wg.id }],
    ] as const) {
      await payload.create({
        collection: 'directory-contacts',
        data: { group: 'focal_points', roleTitle, ...extra } as AnyValue,
        overrideAccess: true,
      })
    }
    const focal = [{ role: 'focal_point', scopeType: 'platform', scopeId: 'platform' }]
    const provision = (spec: AnyValue) =>
      applyAccountSpec(payload, {
        email: `roles-${crypto.randomBytes(6).toString('hex')}@test.invalid`,
        password: `T!${crypto.randomBytes(12).toString('base64url')}`,
        ...spec,
      })
    await provision({ name: active, membershipTrack: 'constituency_work', records: focal })
    // focal point requires active constituency work, so this one holds nothing
    await provision({ name: lapsed, records: focal })
    await provision({
      name: contact,
      membershipTrack: 'constituency_work',
      wg: { slug: wg.slug, role: 'contact' },
    })
    member = await session({})
  })

  const rows = async (cookie?: string) =>
    (await (await api('/directory', cookie ? { cookie } : {})).json()).items as Doc[]
  const names = (row: Doc | undefined) => (row?.holders || []).map((h: Doc) => h.displayName)

  it('names current holders for members', async () => {
    const items = await rows(member.cookie)
    const focalRow = items.find((row) => row.roleTitle === FOCAL_ROLE)
    expect(names(focalRow)).toContain(active)
    expect(names(focalRow)).not.toContain(lapsed)
    expect(names(items.find((row) => row.roleTitle === WG_ROLE))).toEqual([contact])
  })

  it('never shows holders to anonymous callers', async () => {
    const focalRow = (await rows()).find((row) => row.roleTitle === FOCAL_ROLE)
    expect(focalRow).toBeDefined()
    expect(focalRow?.holders).toBeUndefined()
  })

  it('makes a multi-scope role say which scope type it uses', async () => {
    const payload = await testPayload()
    const create = (extra: AnyValue) =>
      payload.create({
        collection: 'directory-contacts',
        data: { group: 'working_groups', roleTitle: `Scoped ${tag}`, ...extra } as AnyValue,
        overrideAccess: true,
      })
    // wg.contact_point can sit under a working group or a body
    await expect(create({ role: 'wg.contact_point', scopeId: 'x' })).rejects.toThrow()
    const ok = await create({ role: 'wg.contact_point', scopeType: 'working_group', scopeId: 'x' })
    // a single-scope role still falls back without one
    const single = await create({ role: 'focal_point', scopeId: 'platform' })
    for (const id of [ok.id, single.id])
      await payload.delete({ collection: 'directory-contacts', id, overrideAccess: true })
  })
})
