import { describe, it, beforeAll, expect } from 'vitest'

import { AVATAR_CHOICES, avatarDataUri, cleanAvatar, resolveAvatar } from '../../src/shared/avatar'
import { testPayload } from './provision'
import { api, session } from './helpers'

const WITHHELD = {
  head: ['bear'],
  face: ['cyclops', 'monster', 'rage', 'angryWithFang', 'veryAngry', 'contempt'],
}

describe('avatar allowlist', () => {
  it('leaves the withheld options out of the choices', () => {
    for (const value of WITHHELD.head) expect(AVATAR_CHOICES.head).not.toContain(value)
    for (const value of WITHHELD.face) expect(AVATAR_CHOICES.face).not.toContain(value)
    expect(AVATAR_CHOICES.head.length).toBeGreaterThan(40)
    expect(AVATAR_CHOICES.face.length).toBeGreaterThan(20)
  })

  it('never draws a withheld option as a seeded default', () => {
    for (let seed = 0; seed < 300; seed++) {
      const drawn = resolveAvatar(seed)
      expect(WITHHELD.head).not.toContain(drawn.head)
      expect(WITHHELD.face).not.toContain(drawn.face)
    }
  })

  it('draws the seeded default for a stored pick that is no longer allowed', () => {
    const legacy = { head: 'bear', face: 'rage', skinColor: AVATAR_CHOICES.skinColor[1] }
    expect(cleanAvatar(legacy)).toEqual({ skinColor: legacy.skinColor })
    expect(avatarDataUri(7, legacy)).toBe(avatarDataUri(7, { skinColor: legacy.skinColor }))
  })
})

describe('member avatar builder', () => {
  let member: Awaited<ReturnType<typeof session>>
  let unverified: Awaited<ReturnType<typeof session>>
  const put = (body: unknown, cookie?: string) =>
    api('/member/profile/avatar', { method: 'PUT', cookie, body: JSON.stringify(body) })
  const valid = {
    head: AVATAR_CHOICES.head[0],
    face: AVATAR_CHOICES.face[0],
    facialHair: 'none',
    skinColor: AVATAR_CHOICES.skinColor[0],
  }

  beforeAll(async () => {
    member = await session({})
    unverified = await session({ verified: false })
  })

  it('stores allowlisted picks and returns them with the profile', async () => {
    const res = await put({ avatar: valid }, member.cookie)
    expect(res.status).toBe(200)
    expect((await res.json()).avatar).toEqual(valid)
    const profile = await (await api('/member/profile', { cookie: member.cookie })).json()
    expect(profile.profile.avatar).toEqual(valid)
  })

  it('shows the picks to other verified members', async () => {
    await api('/member/profile', {
      method: 'PATCH',
      cookie: member.cookie,
      body: JSON.stringify({ displayName: 'Avatar spec', directoryVisibility: 'members' }),
    })
    const viewer = await session({})
    const res = await api(`/member/people/${member.account.id}`, { cookie: viewer.cookie })
    expect(res.status).toBe(200)
    expect((await res.json()).person.avatar).toEqual(valid)
  })

  it('resets to the seeded default with null', async () => {
    expect((await put({ avatar: null }, member.cookie)).status).toBe(200)
    const profile = await (await api('/member/profile', { cookie: member.cookie })).json()
    expect(profile.profile.avatar).toBeNull()
  })

  it.each([
    ['an unknown key', { ...valid, src: 'https://example.test/a.png' }],
    ['an unknown value', { ...valid, head: 'crown' }],
    ['a withheld head', { ...valid, head: 'bear' }],
    ['a withheld face', { ...valid, face: 'rage' }],
    ['a colour outside the palette', { ...valid, skinColor: '123456' }],
    ['a non-string value', { ...valid, face: ['smile'] }],
    ['free text', 'smile'],
  ])('rejects %s', async (_label, avatar) => {
    const res = await put({ avatar }, member.cookie)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation')
  })

  it('still serves a profile whose stored picks have left the allowlist', async () => {
    const payload = await testPayload()
    const legacy = { head: 'bear', face: 'rage' }
    await payload.update({
      collection: 'member-profiles',
      where: { account: { equals: member.account.id } },
      data: { avatar: legacy },
      overrideAccess: true,
    })
    const own = await api('/member/profile', { cookie: member.cookie })
    expect(own.status).toBe(200)
    const person = await api(`/member/people/${member.account.id}`, { cookie: member.cookie })
    expect(person.status).toBe(200)
    expect(cleanAvatar((await person.json()).person.avatar)).toEqual({})
  })

  it('rejects a body without the avatar field', async () => {
    expect((await put({}, member.cookie)).status).toBe(400)
  })

  it('requires a signed-in, verified member', async () => {
    expect((await put({ avatar: valid })).status).toBe(401)
    expect((await put({ avatar: valid }, unverified.cookie)).status).toBe(403)
  })

  it('no longer serves photo uploads', async () => {
    const upload = await api('/member/profile/photo', {
      method: 'PUT',
      cookie: member.cookie,
      headers: { 'Content-Type': 'image/png' },
      body: 'x',
    })
    expect(upload.status).toBe(404)
    const read = await api(`/member/people/${member.account.id}/photo`, { cookie: member.cookie })
    expect(read.status).toBe(404)
  })
})
