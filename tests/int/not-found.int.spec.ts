import { describe, expect, it } from 'vitest'
import { BASE } from './helpers'

// the Hub is one page at /hub; paths it used to serve redirect into it, keeping path and query
describe('hub routes', () => {
  it('serves the app at /hub', async () => {
    const res = await fetch(`${BASE}/hub`)
    expect(res.status).toBe(200)
  })

  it.each([
    ['/calendar', '/hub#/calendar'],
    ['/groups/some-group?tab=members', '/hub#/groups/some-group?tab=members'],
    ['/staff/review/opportunities', '/hub#/staff/review/opportunities'],
  ])('redirects the old path %s into the app', async (from, to) => {
    const res = await fetch(`${BASE}${from}`, { redirect: 'manual' })
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${BASE}${to}`)
  })
})

// the member layout is client-gated, so the 404 comes from the catch-all route handler
describe('unknown routes', () => {
  it('answers 404 for a path no page owns', async () => {
    const res = await fetch(`${BASE}/definitely-not-a-page`)
    expect(res.status).toBe(404)
  })

  it('answers 404 for a nested unknown path', async () => {
    const res = await fetch(`${BASE}/groups-nope/deep/path`)
    expect(res.status).toBe(404)
  })

  it('still answers 200 for known pages', async () => {
    for (const path of ['/', '/signin', '/about', '/our-work', '/learn', '/privacy']) {
      const res = await fetch(`${BASE}${path}`)
      expect(res.status, path).toBe(200)
    }
  })
})
