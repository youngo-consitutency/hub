/**
 * The integration and browser tests CREATE accounts, working groups and content in whatever
 * DATABASE_URL names. `.env.example` and the README point that at `youngo_dev`, which on a
 * maintainer's machine can hold real member data, so tests refuse any database that is not
 * clearly disposable. Name it `*_test`, `*_ci`, `*_smoke`, `*_design` or `*_scratch`, or set
 * ALLOW_TEST_DB=1 when you are certain.
 */
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
