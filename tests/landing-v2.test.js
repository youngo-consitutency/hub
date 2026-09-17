import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('AccessGate renders PlatformLandingV2 for /landingV2 and keeps / as the live desk', async () => {
  const accessGate = await read('src/components/AccessGate.jsx')

  const v2Guard = accessGate.indexOf(
    "path === '/landingV2' || path.startsWith('/landingV2/')",
  )
  const readyGuard = accessGate.indexOf('if (!ready)')
  const accountGuard = accessGate.indexOf('if (account)')
  const liveDesk = accessGate.search(
    /if \(path === '\/'\) \{\s*return <PlatformLanding /,
  )

  assert.notEqual(v2Guard, -1, 'landingV2 must be an explicit public path')
  assert.ok(
    v2Guard < readyGuard,
    'landingV2 must be public before the ready gate, like /about',
  )
  assert.ok(
    v2Guard < accountGuard,
    'a signed-in teammate must be able to review /landingV2',
  )
  assert.notEqual(liveDesk, -1, '/ must still render the live PlatformLanding')
  assert.ok(liveDesk > accountGuard, '/ remains the signed-out live desk')
  assert.match(
    accessGate,
    /<PlatformLandingV2 onAuthenticated={handleAuthenticated} \/>/,
  )
  assert.match(
    accessGate,
    /<PlatformLanding onAuthenticated={handleAuthenticated} \/>/,
  )
  assert.doesNotMatch(
    accessGate,
    /if \(path === '\/'\) \{\s*return <PlatformLandingV2/,
  )
  assert.match(accessGate, /path === '\/landingV2'[\s\S]*?navigate\('\/'\)/)
})

test('constituency-facing V2 keeps the desk and a public YOUNGO face', async () => {
  const [landing, css, appCss] = await Promise.all([
    read('src/pages/PlatformLandingV2.jsx'),
    read('src/styles/parts/platform-landing-v2.css'),
    read('src/styles/app.css'),
  ])

  assert.match(landing, /Your place in global climate action\./)
  assert.match(landing, /<Brand constituencyOnly \/>/)
  assert.match(landing, /Preview — constituency-facing door\./)
  assert.match(landing, /The live Hub desk stays at \//)
  assert.match(landing, /<A href="\/">The live Hub desk stays at \/<\/A>/)
  assert.match(landing, /<LandingSignIn onAuthenticated={onAuthenticated} \/>/)
  assert.match(landing, /href="\/join"/)
  assert.match(landing, /href="#signin"/)
  assert.match(landing, /YOUNGO_NETWORK/)
  assert.match(landing, /site\.current/)
  assert.match(landing, /id="what-it-does"/)
  assert.match(landing, /id="around-youngo"/)
  assert.match(landing, /id="trust"/)
  assert.match(landing, /skipLink/)
  assert.doesNotMatch(landing, /unfccc[^"'`\n]*emblem|emblem[^"'`\n]*unfccc/i)
  assert.doesNotMatch(landing, /coy21-identity/i)
  assert.doesNotMatch(
    landing,
    /climatecoy\.com\/[^"'\s]*\.(png|jpe?g|webp|svg)/i,
  )

  assert.match(landing, /\/landing-v2\/hero\.jpg/)
  assert.match(css, /--landing-teal/)
  assert.match(css, /--landing-lime/)
  assert.match(css, /--landing-forest/)
  assert.doesNotMatch(css, /unfccc[^"'`\n]*emblem|emblem[^"'`\n]*unfccc/i)
  assert.doesNotMatch(css, /coy21-identity/i)
  assert.doesNotMatch(css, /climatecoy\.com\/[^"'\s]*\.(png|jpe?g|webp|svg)/i)

  const liveImport = appCss.indexOf('./parts/platform-landing.css')
  const v2Import = appCss.indexOf('./parts/platform-landing-v2.css')
  assert.notEqual(liveImport, -1, 'live landing CSS must stay imported')
  assert.notEqual(v2Import, -1, 'V2 CSS must be imported from app.css')
  assert.ok(v2Import > liveImport, 'V2 CSS must follow platform-landing.css')
})
