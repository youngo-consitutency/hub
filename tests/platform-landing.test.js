import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  FALLBACK_PROOF_ITEMS,
  publicLandingProofItems,
  selectPublicLandingProof,
} from '../src/lib/publicLandingProof.js'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('platform landing keeps public information, sign-in, and joining reachable', async () => {
  const [landing, css] = await Promise.all([
    read('src/pages/PlatformLanding.jsx'),
    read('src/styles/parts/platform-landing.css'),
  ])

  assert.match(landing, /href="\/about">About YOUNGO/)
  assert.match(landing, /className="platformSignIn" href="#signin"/)
  assert.match(
    landing,
    /className="btn btn-primary platformJoinButton" href="\/join"/,
  )
  assert.match(landing, /href="#signin"/)
  assert.match(landing, /href="\/join"/)
  assert.match(landing, /<LandingSignIn onAuthenticated={onAuthenticated} \/>/)
  assert.match(landing, /usePublicLandingProof/)

  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/)
  assert.match(
    css,
    /li:nth-child\(4\),\s*\n\s*\.platformModuleGrid li:nth-child\(5\)/,
  )

  const mobile = (css.split('@media (max-width: 800px)')[1] || '').split(
    '@media',
  )[0]
  assert.match(
    mobile,
    /\.platformHeroInner\s*{[\s\S]*?grid-template-columns:\s*1fr/,
  )
  // The mobile header retains entry points while the duplicate hero actions hide.
  assert.doesNotMatch(mobile, /\.platformHeaderActions[^}]*display:\s*none/)
  assert.doesNotMatch(mobile, /\.platformAuth[^}]*display:\s*none/)
})

test('public landing proof falls back when the public APIs are quiet or fail', () => {
  const empty = selectPublicLandingProof({
    events: [],
    groups: [],
    submissions: [],
  })
  assert.equal(empty.status, 'empty')
  assert.deepEqual(publicLandingProofItems(empty), FALLBACK_PROOF_ITEMS)
  assert.deepEqual(
    publicLandingProofItems({ status: 'error' }),
    FALLBACK_PROOF_ITEMS,
  )
  assert.deepEqual(
    publicLandingProofItems({ status: 'loading' }),
    FALLBACK_PROOF_ITEMS,
  )

  const ready = selectPublicLandingProof({
    now: Date.parse('2026-09-15T00:00:00.000Z'),
    events: [
      {
        title: 'Food & Agriculture WG — GYS Consultation #3',
        startsAt: '2026-09-16T16:00:00.000Z',
      },
    ],
    groups: [{ slug: 'ace' }, { slug: 'finance' }],
    submissions: [{ title: 'Just Transition input', deadlineAt: '2026-10-01' }],
  })
  assert.equal(ready.status, 'ready')
  assert.equal(ready.groupCount, 2)
  const items = publicLandingProofItems(ready)
  assert.match(items[0].text, /Next: Food & Agriculture WG/)
  assert.equal(items[0].href, '/about')
  assert.equal(items[1].text, '2 working groups you can read about')
  assert.equal(items[1].href, '/about/working-groups')
  assert.equal(items[2].text, 'Just Transition input')
})
