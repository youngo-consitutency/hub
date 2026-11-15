import type { CollectionSlug, Payload } from 'payload'
import type { AnyValue } from '../../src/lib/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testPayload } from './provision'
import { api, session } from './helpers'

// the generated rest surface may only hand out published content or the
// caller's own rows; everything else goes through the domain endpoints
const PUBLIC: Record<string, (doc: AnyValue) => boolean> = {
  media: () => true,
  'content-documents': () => true,
  'catalogue-resources': (d) => d.verificationStatus !== 'retired',
  'content-submissions': () => true,
  'gys-cycles': () => true,
  'content-events': (d) => d.state === 'published' && d.meetingUrl === undefined,
  'content-announcements': (d) => d.state === 'published',
  'content-coys': (d) => d.reviewStatus === 'approved' && d.organizerEmail === undefined,
  opportunities: (d) => d.status === 'published' && d.reviewNote === undefined,
}

// capability-scoped reads: the platform operator below holds platform.manage and
// audit.read but not membership.review, so guardian enquiries stay closed
const OPERATOR_READS = new Set([
  'audit-log',
  'handovers',
  'funding-requests',
  'coi-declarations',
  'recognition-requests',
  'partnership-requests',
  'privacy-requests',
])

// own-row reads: the key that must point back at the caller
const OWNER_KEYS = ['account', 'orgAccount', 'memberAccount']

const ownedBy = (doc: AnyValue, id: unknown) =>
  OWNER_KEYS.some((k) => doc[k] != null && String(doc[k]) === String(id)) ||
  (doc.user?.value != null && String(doc.user.value) === String(id))

const tag = `rest-${Math.random().toString(36).slice(2, 8)}`

describe('generated REST surface', () => {
  let payload: Payload
  let slugs: string[]
  let viewers: { label: string; cookie?: string; id?: unknown; scoped?: Set<string> }[]
  let handoverId: unknown
  const hidden: { collection: CollectionSlug; id: number | string }[] = []

  beforeAll(async () => {
    payload = await testPayload()
    slugs = payload.config.collections.map((c) => c.slug)
    const unverified = await session({ verified: false })
    const member = await session({})
    const operator = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'gct.internal', scopeType: 'team', scopeId: 'gct' }],
    })
    viewers = [
      { label: 'anonymous' },
      { label: 'unverified', cookie: unverified.cookie, id: unverified.account.id },
      { label: 'member', cookie: member.cookie, id: member.account.id },
      {
        label: 'operator',
        cookie: operator.cookie,
        id: operator.account.id,
        scoped: OPERATOR_READS,
      },
    ]
    // non-public rows the assertions must never see
    const make = async (collection: CollectionSlug, data: AnyValue) => {
      const doc = await payload.create({ collection, data, overrideAccess: true })
      hidden.push({ collection, id: doc.id })
    }
    await make('content-events', {
      slug: `${tag}-event`,
      title: tag,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      state: 'unpublished',
    })
    await make('content-coys', {
      slug: `${tag}-coy`,
      title: tag,
      reviewStatus: 'pending',
      organizerEmail: `${tag}@test.invalid`,
    })
    await make('opportunities', { slug: `${tag}-opp`, title: tag, status: 'draft' })
    await make('catalogue-resources', {
      slug: `${tag}-res`,
      title: tag,
      url: `https://${tag}.test.invalid`,
      verificationStatus: 'retired',
    })
    // another account's profile, so the member reads it as a third party
    await make('member-profiles', { account: unverified.account.id, displayName: tag })
    // capability-scoped row: only its owner and the operator may read it
    const now = new Date().toISOString()
    const handover = await payload.create({
      collection: 'handovers',
      data: {
        account: unverified.account.id,
        reason: 'other',
        status: 'open',
        scopeLabel: 'rest probe',
        dueAt: now,
        openedBy: unverified.account.id,
        openedAt: now,
      },
      overrideAccess: true,
    })
    handoverId = handover.id
    hidden.push({ collection: 'handovers', id: handover.id })
  })

  afterAll(async () => {
    for (const { collection, id } of hidden.reverse())
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
  })

  it('returns nothing non-public from any collection', async () => {
    expect(slugs.length).toBeGreaterThan(20)
    for (const viewer of viewers) {
      for (const slug of slugs) {
        // unpaginated so a leaked row can't hide on a later page
        const res = await api(`/${slug}?depth=0&pagination=false`, { cookie: viewer.cookie })
        const where = `${viewer.label} GET /api/${slug} -> ${res.status}`
        const text = await res.text()
        expect(text, where).not.toContain(tag)
        if (res.status !== 200) {
          expect([401, 403, 404, 501], where).toContain(res.status)
          continue
        }
        const body = JSON.parse(text)
        expect(body.hasNextPage ?? false, where).toBe(false)
        const docs: AnyValue[] = body.docs || []
        const allowed = PUBLIC[slug]
        for (const doc of docs) {
          if (viewer.scoped?.has(slug)) continue
          if (allowed) expect(allowed(doc), `${where} doc ${doc.id}`).toBe(true)
          else if (slug === 'accounts') expect(String(doc.id), where).toBe(String(viewer.id))
          else
            expect(viewer.id != null && ownedBy(doc, viewer.id), `${where} doc ${doc.id}`).toBe(
              true,
            )
        }
      }
    }
  })

  it('scopes capability reads to the capability holder', async () => {
    const ids = async (cookie?: string) =>
      (
        (await (await api('/handovers?depth=0&pagination=false', { cookie })).json()).docs || []
      ).map((d: AnyValue) => String(d.id))
    expect(await ids(viewers[3].cookie)).toContain(String(handoverId))
    expect(await ids(viewers[1].cookie)).toContain(String(handoverId))
    expect(await ids(viewers[2].cookie)).not.toContain(String(handoverId))
  })

  it('refuses member writes to document locks', async () => {
    const [, , member] = viewers
    const res = await api('/payload-locked-documents', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        globalSlug: tag,
        user: { relationTo: 'accounts', value: member.id },
      }),
    })
    expect(res.status).toBe(403)
    const { totalDocs } = await payload.count({
      collection: 'payload-locked-documents',
      where: { globalSlug: { equals: tag } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
  })

  it('refuses member writes to resource issues', async () => {
    const res = await api('/resource-issues', {
      method: 'POST',
      cookie: viewers[2].cookie,
      body: JSON.stringify({
        resourceSlug: tag,
        kind: 'other',
        detail: 'generated rest probe',
        reportedBy: viewers[2].id,
      }),
    })
    expect(res.status).toBe(403)
    const { totalDocs } = await payload.count({
      collection: 'resource-issues',
      where: { resourceSlug: { equals: tag } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
  })

  it("refuses payload's built-in auth routes", async () => {
    const email = `${tag}@test.invalid`
    for (const path of [
      '/accounts/forgot-password',
      '/accounts/reset-password',
      '/accounts/login',
      '/accounts/unlock',
    ]) {
      const res = await api(path, {
        method: 'POST',
        body: JSON.stringify({ email, password: 'Probe!12345678', token: 'x' }),
      })
      expect(res.status, path).toBe(501)
    }
    expect((await api('/accounts/me', { cookie: viewers[2].cookie })).status).toBe(501)
  })
})
