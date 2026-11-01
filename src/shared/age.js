// Calendar age in UTC. A date is only YYYY-MM-DD. Birthday on today's UTC
// date is 18. Year-only strings and impossible dates are not an age.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function ageFromDob(dob, now = new Date()) {
  const match = DATE_ONLY.exec(String(dob ?? '').trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }
  let age = now.getUTCFullYear() - year
  const monthDelta = now.getUTCMonth() + 1 - month
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < day)) age -= 1
  return age
}
