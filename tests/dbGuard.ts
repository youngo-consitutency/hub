/** Tests refuse any DATABASE_URL not named `*_test`, `*_ci`, `*_smoke`, `*_design` or `*_scratch`; set ALLOW_TEST_DB=1 to override. */
const DISPOSABLE = /(^|_)(test|ci|smoke|design|scratch)$/

export function assertTestDatabase(url = process.env.DATABASE_URL) {
  if (process.env.ALLOW_TEST_DB === '1') return
  let name = ''
  try {
    name = new URL(url ?? '').pathname.replace(/^\//, '')
  } catch {
    throw new Error('Tests need DATABASE_URL set to a disposable database (e.g. youngo_test).')
  }
  if (!DISPOSABLE.test(name)) {
    throw new Error(
      `Refusing to run tests against "${name}": they create accounts and content there. ` +
        'Use a disposable database named *_test, *_ci, *_smoke, *_design or *_scratch ' +
        '(or set ALLOW_TEST_DB=1 if you are certain it holds no real data).',
    )
  }
}
