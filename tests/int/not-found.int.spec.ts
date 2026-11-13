import { describe, expect, it } from 'vitest'
import { BASE } from './helpers'

// the member app is client-rendered, so the status has to come from the server catch-all
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
    for (const path of ['/', '/signin', '/about/faq', '/privacy']) {
      const res = await fetch(`${BASE}${path}`)
      expect(res.status, path).toBe(200)
    }
  })
})
