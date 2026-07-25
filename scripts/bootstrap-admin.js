// Explicitly promote existing, verified accounts to platform administrators.
// Usage: ADMIN_EMAILS=admin@example.org DATABASE_URL=... npm run bootstrap-admin
import { findAccountByEmail, publicAccount } from '../server/lib/accounts.js'
import { setAccountFields } from '../server/lib/lifecycle.js'
import { getPool } from '../server/lib/db.js'

const emails = String(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

async function promoteExistingAccount(email) {
  const row = await findAccountByEmail(email)
  if (!row) {
    throw new Error(`No account exists for ${email}. Register and verify it before promotion.`)
  }

  const account = publicAccount(row)
  if (!account.isVerified) {
    throw new Error(`Account ${email} is not verified. Verify it before promotion.`)
  }

  return setAccountFields(account.id, {
    role: 'admin',
    verified_by: 'explicit_admin_bootstrap',
  })
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for administrator bootstrap.')
  }
  if (!emails.length) {
    throw new Error('ADMIN_EMAILS is required; there is no default administrator.')
  }

  const pool = getPool()
  try {
    for (const email of emails) {
      const account = await promoteExistingAccount(email)
      console.log(JSON.stringify({
        event: 'admin_promoted',
        accountId: account.id,
        email: account.email,
      }))
    }
  } finally {
    if (pool) await pool.end()
  }
}

main().catch((err) => {
  console.error(`bootstrap-admin: ${err.message}`)
  process.exit(1)
})
