// Route guards applied by the member layout. They improve the interface
// only — the API still enforces every permission.
import type { AnyValue } from './types'
import { lockFor } from './routes'
import { Locked } from '../components/Locked'

// Routes reachable while the membership course is incomplete.
export const PRE_VERIFY = [
  /^\/onboarding/,
  /^\/library/,
  /^\/resources/,
  /^\/recognition/,
  /^\/privacy/,
  /^\/help/,
  /^\/about/,
  /^\/membership\/appeal/,
]

export function isPreVerify(path: AnyValue) {
  return PRE_VERIFY.some((re) => re.test(path))
}

// the locked screen this path + account resolves to, or null. role locks come
// from the route registry, so the sidebar and the guards share one rule
export function lockedFor(path: string, account: AnyValue) {
  if (account && !account.isVerified && !isPreVerify(path)) return <Locked course />
  const lock = lockFor(path, account)
  return lock ? (
    <Locked title={lock.title} body={lock.body} retry={'retry' in lock} busy={'busy' in lock} />
  ) : null
}
