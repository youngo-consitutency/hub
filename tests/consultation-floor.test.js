import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.js'
import { normalizeContributionInput } from '../server/lib/consultationContributions.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(here, '../public')

function startApp(env = {}) {
  const app = createApp({ env, dist: publicDir })
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      resolve({
        server,
        origin: `http://127.0.0.1:${port}`,
        close() {
          server.closeAllConnections?.()
          return new Promise((done) => server.close(done))
        },
      })
    })
  })
}

test('consultation contribution input keeps a usable public note', () => {
  const item = normalizeContributionInput({
    kind: 'feature',
    body: '  Add regional filters on opportunities. ',
    name: 'WG contact',
    section: 'uses',
  })
  assert.equal(item.kind, 'feature')
  assert.equal(item.body, 'Add regional filters on opportunities.')
  assert.equal(item.displayName, 'WG contact')
  assert.equal(item.section, 'uses')
})

test('consultation contribution input defaults unknown sections to the whole consultation', () => {
  const item = normalizeContributionInput({
    kind: 'comment',
    body: 'Keep this attached to the whole session.',
    section: 'not-a-slide',
  })
  assert.equal(item.section, 'general')
})

test('consultation contribution input rejects empty or unknown kinds', () => {
  assert.throws(
    () =>
      normalizeContributionInput({ kind: 'rant', body: 'This is long enough' }),
    {
      code: 'validation',
    },
  )
  assert.throws(
    () => normalizeContributionInput({ kind: 'question', body: 'Hi' }),
    {
      code: 'validation',
    },
  )
})

test('consultation contribution input strips markup and caps length', () => {
  const item = normalizeContributionInput({
    kind: 'comment',
    body: `<script>alert(1)</script>${'x'.repeat(900)}`,
  })
  assert.equal(item.body.includes('<'), false)
  assert.equal(item.body.length, 800)
  assert.equal(item.displayName, null)
})

test('consultation page and public floor work, including read-only preview', async (t) => {
  const { origin, close } = await startApp({ READ_ONLY_PREVIEW: '1' })
  t.after(() => close())

  const page = await fetch(`${origin}/consultation`)
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.match(html, /Help shape a shared YOUNGO Hub/)
  assert.match(html, /Joining takes one to two months/)
  assert.match(html, /once every six months/)
  assert.match(html, /title-slide/)
  assert.match(html, />YOUNGO Hub</)
  assert.match(html, /id="fullscreen"/)
  assert.match(html, /This is what the Hub is built to do/)
  assert.match(html, /Click a card to see how that part of the Hub looks/)
  assert.match(html, /consultation\/assets\/features\/membership\.jpg/)
  assert.match(html, /Add to the floor/)
  assert.match(html, /See the floor/)
  assert.match(html, /What do you want to add/)
  assert.match(html, /Point this to/)

  const created = await fetch(`${origin}/api/consultation/contributions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'question',
      body: 'How will under-18 guardian data be reviewed?',
      name: 'Member',
      section: 'security',
    }),
  })
  assert.equal(created.status, 201)
  const payload = await created.json()
  assert.equal(payload.item.kind, 'question')
  assert.equal(payload.item.name, 'Member')
  assert.equal(payload.item.section, 'security')

  const honeypot = await fetch(`${origin}/api/consultation/contributions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'comment',
      body: 'This should be ignored because it is a bot.',
      website: 'https://spam.example',
    }),
  })
  assert.equal(honeypot.status, 201)

  const listed = await fetch(`${origin}/api/consultation/contributions`)
  assert.equal(listed.status, 200)
  const board = await listed.json()
  assert.ok(
    board.items.some(
      (item) =>
        item.body.includes('guardian data') && item.section === 'security',
    ),
  )
  const kinds = await fetch(`${origin}/api/consultation/kinds`)
  assert.equal(kinds.status, 200)
  const catalog = await kinds.json()
  assert.ok(catalog.sections.some((section) => section.value === 'need'))
  assert.equal(
    board.items.some((item) => item.body.includes('This should be ignored')),
    false,
  )

  const blocked = await fetch(`${origin}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.org', password: 'secret' }),
  })
  assert.equal(blocked.status, 503)
})
