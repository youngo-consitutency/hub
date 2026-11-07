import { describe, expect, it } from 'vitest'
import {
  ROUTES,
  lockFor,
  mobileNavFor,
  navFor,
  paletteRoutesFor,
  viewerOf,
} from '../../src/member/lib/routes'

// account shapes as the member api returns them
const unverified = { isVerified: false, access: {} }
const member = { isVerified: true, access: { capabilities: [], teamRoles: [] } }
const contactPoint = {
  isVerified: true,
  access: { capabilities: ['wg.manage:finance'], teamRoles: [] },
}
const focalPoint = {
  isVerified: true,
  access: {
    isFocalPoint: true,
    capabilities: ['accounts.manage', 'platform.manage'],
    teamRoles: [],
  },
}
const membershipTeam = {
  isVerified: true,
  access: { capabilities: [], teamRoles: ['membership_team'] },
}

const sections = (account: object) =>
  navFor(viewerOf(account), '/').map((group) => [group.section, group.items.map((i) => i.label)])

describe('route registry', () => {
  it('gives an unverified account only onboarding and resources', () => {
    expect(sections(unverified)).toEqual([['Explore', ['Onboarding', 'Resources']]])
    expect(mobileNavFor(viewerOf(unverified), '/').map((tab) => tab.href)).toEqual([
      '/onboarding',
      '/resources',
    ])
  })

  it('groups a member’s pages and keeps responsibilities out of view', () => {
    expect(sections(member).map(([section]) => section)).toEqual([
      '',
      'Explore',
      'People & groups',
      'Work & decisions',
    ])
    expect(mobileNavFor(viewerOf(member), '/').map((tab) => tab.label)).toEqual([
      'Calendar',
      'Opportunities',
      'Home',
      'Groups',
      'Profile',
    ])
  })

  it('separates mandates, teams and operating the Hub by actor', () => {
    const cp = Object.fromEntries(sections(contactPoint))
    expect(cp['Your responsibilities']).toEqual([
      'WG Contact Point',
      'Mail Desk',
      'Agent connector',
    ])
    expect(Object.fromEntries(sections(membershipTeam)).Teams).toEqual([
      'Membership Team',
      'Review queue',
    ])
    const fp = Object.fromEntries(sections(focalPoint))
    expect(fp['Your responsibilities']).toContain('Global Focal Point')
    expect(fp['Operate the Hub']).toEqual(['Admin'])
  })

  it('locks guarded pages for accounts without the role', () => {
    expect(lockFor('/admin', member)?.title).toBe('Admin only')
    expect(lockFor('/admin/accounts', member)?.title).toBe('Admin only')
    expect(lockFor('/admin', focalPoint)).toBeNull()
    expect(lockFor('/team/membership/renewals', member)?.title).toBe('Membership Team only')
    expect(lockFor('/staff/review', membershipTeam)).toBeNull()
    expect(lockFor('/ngo', member)?.title).toBe('NGO access required')
    // a seat invite opens before the seat exists
    expect(lockFor('/ngo/accept', member)).toBeNull()
    expect(lockFor('/calendar', member)).toBeNull()
    expect(lockFor('/admin', null)).toBeNull()
  })

  it('limits contact points to their own groups', () => {
    expect(lockFor('/cp', member)?.title).toBe('WG Contact Points only')
    expect(lockFor('/cp', contactPoint)).toBeNull()
    expect(lockFor('/cp/finance', contactPoint)).toBeNull()
    expect(lockFor('/cp/energy', contactPoint)?.body).toMatch(/this working group/)
  })

  it('never lists a page the guard would lock, and the reverse', () => {
    for (const account of [unverified, member, contactPoint, focalPoint, membershipTeam]) {
      const visible = new Set(
        navFor(viewerOf(account), '/').flatMap((g) => g.items.map((i) => i.href)),
      )
      for (const route of ROUTES.filter((r) => r.locked)) {
        if (!account.isVerified) continue
        expect(visible.has(route.href), `${route.href}`).toBe(lockFor(route.href, account) === null)
      }
    }
  })

  it('offers palette shortcuts only for pages the account can open', () => {
    expect(paletteRoutesFor(viewerOf(unverified))).toEqual([])
    expect(paletteRoutesFor(viewerOf(member)).map((r) => r.label)).toEqual([
      'Calendar',
      'Opportunities',
      'Groups',
      'Directory',
      'Tasks',
    ])
  })
})
