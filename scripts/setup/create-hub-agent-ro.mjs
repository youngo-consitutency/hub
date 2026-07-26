import pg from 'pg'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const adminUrl = process.env.DATABASE_PUBLIC_URL
if (!adminUrl) throw new Error('DATABASE_PUBLIC_URL missing')

function clientFor(url) {
  // Railway's public proxy presents a chain Cursor/Node does not trust by
  // default; agent access still requires TLS, just not CA verification here.
  const parsed = new URL(url)
  parsed.search = ''
  return new pg.Client({
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false },
  })
}

const password = randomBytes(32).toString('base64url')
const client = clientFor(adminUrl)
await client.connect()

const db = (await client.query('SELECT current_database() AS db')).rows[0].db
if (db !== 'railway') {
  throw new Error(`Expected database railway, got ${db}`)
}

await client.query(
  `
DO $do$
BEGIN
  CREATE ROLE hub_agent_ro LOGIN PASSWORD $p$${password}$p$;
EXCEPTION
  WHEN duplicate_object THEN
    ALTER ROLE hub_agent_ro WITH LOGIN PASSWORD $p$${password}$p$;
END
$do$;
`,
)
await client.query('GRANT CONNECT ON DATABASE railway TO hub_agent_ro')
await client.query('GRANT USAGE ON SCHEMA public TO hub_agent_ro')
await client.query('GRANT SELECT ON feedback_tickets TO hub_agent_ro')
await client.query('GRANT SELECT ON ngo_opportunities TO hub_agent_ro')
await client.query(
  'GRANT UPDATE (status, triage_note, updated_at) ON feedback_tickets TO hub_agent_ro',
)

const pub = new URL(adminUrl)
const agentUrl = new URL(adminUrl)
agentUrl.username = 'hub_agent_ro'
agentUrl.password = password
agentUrl.searchParams.set('sslmode', 'require')

const agent = clientFor(agentUrl.toString())
await agent.connect()

const tickets = await agent.query(
  'SELECT count(*)::int AS n FROM feedback_tickets',
)
const opportunities = await agent.query(
  'SELECT count(*)::int AS n FROM ngo_opportunities',
)

let accountsBlocked = false
try {
  await agent.query('SELECT 1 FROM hub_accounts LIMIT 1')
} catch (error) {
  accountsBlocked = /permission denied/i.test(error.message)
}

// Prove column-scoped UPDATE is accepted by the planner without changing rows.
await agent.query(`
  UPDATE feedback_tickets
     SET triage_note = COALESCE(triage_note, ''),
         updated_at = now()
   WHERE false
`)

let titleRewriteBlocked = false
try {
  await agent.query(`
    UPDATE feedback_tickets
       SET title = title
     WHERE false
  `)
} catch (error) {
  titleRewriteBlocked = /permission denied/i.test(error.message)
}

await agent.end()
await client.end()

const outPath = process.env.HUB_AGENT_RO_URL_FILE
if (!outPath) throw new Error('HUB_AGENT_RO_URL_FILE missing')
writeFileSync(outPath, agentUrl.toString(), { encoding: 'utf8', mode: 0o600 })

console.log(
  JSON.stringify(
    {
      ok: true,
      database: db,
      host: pub.hostname,
      port: pub.port,
      ticketCount: tickets.rows[0].n,
      opportunityCount: opportunities.rows[0].n,
      accountsBlocked,
      titleRewriteBlocked,
    },
    null,
    2,
  ),
)
