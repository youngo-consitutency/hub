import { describe, expect, it } from 'vitest'
import { api } from './helpers'

// payload gives every auth collection a first-register endpoint that creates
// an account with overrideAccess while the collection is empty; nothing may
// create accounts outside the registration flow
describe('generated auth surface', () => {
  const attempt = (collection: string) =>
    api(`/${collection}/first-register`, {
      method: 'POST',
      body: JSON.stringify({
        email: `first-${Math.random().toString(36).slice(2, 8)}@test.invalid`,
        password: 'Probe!12345678',
      }),
    })

  it('offers no console login to register', async () => {
    expect((await attempt('users')).status).toBe(404)
    expect((await api('/users/init')).status).toBe(404)
  })

  it('never creates an account through first-register', async () => {
    // accounts has no generated endpoints at all
    const res = await attempt('accounts')
    expect(res.status).toBe(501)
  })
})
