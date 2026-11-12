import { describe, expect, it } from 'vitest'
import {
  ACCESS_FAILED,
  CHECKING_ACCESS,
  ROUTES,
  lockFor,
  responsibilitiesFor,
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
  })

  it('keeps guarded pages calmly locked until access arrives, with a retry only on failure', () => {
    const loading = { isVerified: true }
    expect(lockFor('/admin', loading)).toBe(CHECKING_ACCESS)
    expect(lockFor('/cp/finance', loading)).toBe(CHECKING_ACCESS)
    expect(CHECKING_ACCESS).not.toHaveProperty('retry')
    expect(lockFor('/calendar', loading)).toBeNull()
    const failed = { isVerified: true, accessFailed: true }
    expect(lockFor('/admin', failed)).toBe(ACCESS_FAILED)
    expect(lockFor('/cp/finance', failed)).toBe(ACCESS_FAILED)
    expect(lockFor('/calendar', failed)).toBeNull()
  })

  it('limits contact points to their own groups', () => {
    expect(lockFor('/cp', member)?.title).toBe('WG Contact Points only')
    expect(lockFor('/cp', contactPoint)).toBeNull()
    expect(lockFor('/cp/finance', contactPoint)).toBeNull()
    expect(lockFor('/cp/energy', contactPoint)?.body).toMatch(/this working group/)
  })

  it('never lists a page the guard would lock, and the reverse, on any path', () => {
    const accounts = [member, contactPoint, focalPoint, membershipTeam]
    const paths = ['/', ...ROUTES.map((route) => route.href), '/ngo/accept/token']
    for (const account of accounts) {
      for (const path of paths) {
        const visible = new Set(
          navFor(viewerOf(account), path).flatMap((g) => g.items.map((i) => i.href)),
        )
        for (const route of ROUTES.filter((r) => r.locked)) {
          expect(visible.has(route.href), `${route.href} on ${path}`).toBe(
            lockFor(route.href, account) === null,
          )
        }
      }
    }
  })

  it('lists each page once per account', () => {
    for (const account of [unverified, member, contactPoint, focalPoint, membershipTeam]) {
      const hrefs = navFor(viewerOf(account), '/').flatMap((g) => g.items.map((i) => i.href))
      expect(new Set(hrefs).size).toBe(hrefs.length)
    }
  })

  it('opens seat invites without showing the NGO platform to non-members', () => {
    expect(lockFor('/ngo/accept/token', member)).toBeNull()
    const sections = navFor(viewerOf(member), '/ngo/accept/token')
    expect(sections.flatMap((g) => g.items.map((i) => i.href))).not.toContain('/ngo')
  })

  it('locks everything without an account, and until access arrives', () => {
    expect(lockFor('/team/membership', { isVerified: true })).toBe(CHECKING_ACCESS)
    expect(lockFor('/staff/review', null)?.title).toBe('Review team only')
    expect(lockFor('/admin', null)?.title).toBe('Admin only')
  })

  it('builds home responsibility cards from the same rules as the sidebar', () => {
    const cards = responsibilitiesFor(viewerOf(focalPoint)).map((r) => r.href)
    const sidebar = navFor(viewerOf(focalPoint), '/')
      .filter((g) => ['Your responsibilities', 'Teams', 'Operate the Hub'].includes(g.section))
      .flatMap((g) => g.items.map((i) => i.href))
    expect(cards).toEqual(sidebar)
    expect(responsibilitiesFor(viewerOf(focalPoint)).every((r) => r.summary)).toBe(true)
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
