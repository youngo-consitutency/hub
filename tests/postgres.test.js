import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import pg from 'pg'

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

test(
  'PostgreSQL migrations produce the security-critical schema',
  {
    skip: databaseUrl ? false : 'DATABASE_URL is not set',
  },
  async (t) => {
    const pool = new pg.Pool({ connectionString: databaseUrl })
    t.after(() => pool.end())

    const migrationFiles = (
      await readdir(new URL('../migrations/', import.meta.url))
    )
      .filter((file) => file.endsWith('.sql'))
      .sort()
    const applied = await pool.query(
      'SELECT name FROM schema_migrations ORDER BY name',
    )
    assert.deepEqual(
      applied.rows.map((row) => row.name),
      migrationFiles,
    )

    const columns = await pool.query(
      `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'hub_accounts' AND column_name IN ('password_hash', 'password_salt', 'role', 'member_status', 'email_verified_at', 'must_change_password'))
         OR (table_name = 'hub_sessions' AND column_name IN ('token', 'expires_at'))
         OR (table_name = 'password_reset_tokens' AND column_name IN ('token_hash', 'expires_at', 'used_at'))
         OR (table_name = 'ngo_seats' AND column_name IN ('invite_token_hash', 'invite_expires_at', 'seat_role', 'status'))
         OR (table_name = 'hub_content_revisions' AND column_name IN ('content_type', 'payload', 'status', 'created_by'))
         OR (table_name = 'hub_content_publications' AND column_name IN ('content_type', 'content_key', 'payload', 'revision_id'))
         OR (table_name = 'notification_preferences' AND column_name IN ('category', 'enabled'))
         OR (table_name = 'notification_outbox' AND column_name IN ('deduplication_key', 'status', 'payload'))
         OR (table_name = 'email_suppressions' AND column_name IN ('address_hash', 'reason'))
         OR (table_name = 'negotiation_tracks' AND column_name IN ('slug', 'publication_status'))
         OR (table_name = 'negotiation_document_versions' AND column_name IN ('content_hash', 'supersedes_version_id', 'extraction_confidence', 'original_content', 'quarantine_status'))
         OR (table_name = 'negotiation_calls' AND column_name IN ('external_deadline_date', 'external_deadline_precision'))
         OR (table_name = 'negotiation_follows' AND column_name IN ('account_id', 'track_id', 'digest_frequency'))
         OR (table_name = 'negotiation_document_extractions' AND column_name IN ('document_version_id', 'revision', 'review_status', 'reviewed_by'))
         OR (table_name = 'negotiation_submission_projects' AND column_name IN ('track_id', 'call_id', 'is_initiative', 'current_version'))
         OR (table_name = 'negotiation_submission_versions' AND column_name IN ('project_id', 'version', 'content_hash'))
         OR (table_name = 'negotiation_amendments' AND column_name IN ('target_type', 'target_document_version_id', 'target_project_version_id', 'reconciliation_status'))
         OR (table_name = 'cp_call_slots' AND column_name IN ('host_account_id', 'starts_at', 'status', 'booked_by'))
       )`,
    )
    const actualColumns = new Set(
      columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
    )
    const requiredColumns = [
      'hub_accounts.password_hash',
      'hub_accounts.password_salt',
      'hub_accounts.role',
      'hub_accounts.member_status',
      'hub_accounts.email_verified_at',
      'hub_accounts.must_change_password',
      'cp_call_slots.host_account_id',
      'cp_call_slots.starts_at',
      'cp_call_slots.status',
      'cp_call_slots.booked_by',
      'hub_sessions.token',
      'hub_sessions.expires_at',
      'password_reset_tokens.token_hash',
      'password_reset_tokens.expires_at',
      'password_reset_tokens.used_at',
      'ngo_seats.invite_token_hash',
      'ngo_seats.invite_expires_at',
      'ngo_seats.seat_role',
      'ngo_seats.status',
      'hub_content_revisions.content_type',
      'hub_content_revisions.payload',
      'hub_content_revisions.status',
      'hub_content_revisions.created_by',
      'hub_content_publications.content_type',
      'hub_content_publications.content_key',
      'hub_content_publications.payload',
      'hub_content_publications.revision_id',
      'notification_preferences.category',
      'notification_preferences.enabled',
      'notification_outbox.deduplication_key',
      'notification_outbox.status',
      'notification_outbox.payload',
      'email_suppressions.address_hash',
      'email_suppressions.reason',
      'negotiation_tracks.slug',
      'negotiation_tracks.publication_status',
      'negotiation_document_versions.content_hash',
      'negotiation_document_versions.supersedes_version_id',
      'negotiation_document_versions.extraction_confidence',
      'negotiation_document_versions.original_content',
      'negotiation_document_versions.quarantine_status',
      'negotiation_calls.external_deadline_date',
      'negotiation_calls.external_deadline_precision',
      'negotiation_follows.account_id',
      'negotiation_follows.track_id',
      'negotiation_follows.digest_frequency',
      'negotiation_document_extractions.document_version_id',
      'negotiation_document_extractions.revision',
      'negotiation_document_extractions.review_status',
      'negotiation_document_extractions.reviewed_by',
      'negotiation_submission_projects.track_id',
      'negotiation_submission_projects.call_id',
      'negotiation_submission_projects.is_initiative',
      'negotiation_submission_projects.current_version',
      'negotiation_submission_versions.project_id',
      'negotiation_submission_versions.version',
      'negotiation_submission_versions.content_hash',
      'negotiation_amendments.target_type',
      'negotiation_amendments.target_document_version_id',
      'negotiation_amendments.target_project_version_id',
      'negotiation_amendments.reconciliation_status',
    ]
    for (const column of requiredColumns) {
      assert.ok(actualColumns.has(column), `missing migrated column: ${column}`)
    }

    const indexes = await pool.query(
      `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN (
         'idx_ngo_seats_invite_hash',
         'idx_ngo_seats_active_member',
         'password_reset_tokens_token_hash_key',
         'uq_push_subscriptions_endpoint',
         'idx_notification_outbox_due',
         'idx_notification_outbox_account_active'
         ,'idx_negotiation_tracks_public'
         ,'idx_negotiation_document_versions_document'
         ,'idx_negotiation_calls_public_deadline'
         ,'idx_negotiation_follows_account'
         ,'idx_negotiation_extractions_version'
         ,'idx_negotiation_projects_owner'
         ,'idx_negotiation_versions_project'
         ,'idx_negotiation_amendments_project'
       )`,
    )
    assert.deepEqual(
      new Set(indexes.rows.map((row) => row.indexname)),
      new Set([
        'idx_ngo_seats_invite_hash',
        'idx_ngo_seats_active_member',
        'password_reset_tokens_token_hash_key',
        'uq_push_subscriptions_endpoint',
        'idx_notification_outbox_due',
        'idx_notification_outbox_account_active',
        'idx_negotiation_tracks_public',
        'idx_negotiation_document_versions_document',
        'idx_negotiation_calls_public_deadline',
        'idx_negotiation_follows_account',
        'idx_negotiation_extractions_version',
        'idx_negotiation_projects_owner',
        'idx_negotiation_versions_project',
        'idx_negotiation_amendments_project',
      ]),
    )
  },
)

test(
  'PostgreSQL push path keeps one owner per subscription endpoint',
  {
    skip: databaseUrl ? false : 'DATABASE_URL is not set',
  },
  async (t) => {
    const previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = databaseUrl
    const [{ getPool }, pushStore] = await Promise.all([
      import('../server/lib/db.js'),
      import('../server/lib/pushStore.js'),
    ])
    const pool = getPool()
    t.after(async () => {
      await pool.query(
        `DELETE FROM hub_accounts WHERE email LIKE 'postgres-test-%@example.org'`,
      )
      await pool.end()
      if (previousDatabaseUrl == null) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previousDatabaseUrl
    })

    const { rows: accounts } = await pool.query(
      `INSERT INTO hub_accounts (
       email, password_hash, password_salt, name, entity_type,
       membership_track, country, membership_policy_version,
       member_status, hub_access_status
     )
     VALUES
       ('postgres-test-a@example.org', 'hash', 'salt', 'Member A', 'individual',
        'network', 'Kenya', 'test', 'verified', 'active'),
       ('postgres-test-b@example.org', 'hash', 'salt', 'Member B', 'individual',
        'network', 'Ghana', 'test', 'verified', 'active')
     RETURNING id`,
    )
    const [accountA, accountB] = accounts.map((row) => row.id)
    const endpoint = 'https://fcm.googleapis.com/postgres-shared-device'
    await pushStore.saveSubscription({
      accountId: accountA,
      subscription: { endpoint, keys: { p256dh: 'a', auth: 'a' } },
    })
    await pushStore.saveSubscription({
      accountId: accountB,
      subscription: { endpoint, keys: { p256dh: 'b', auth: 'b' } },
    })
    assert.equal(
      (await pushStore.listSubscriptionsForAccounts(accountA)).length,
      0,
    )
    const ownerRows = await pushStore.listSubscriptionsForAccounts(accountB)
    assert.equal(ownerRows.length, 1)
    assert.equal(ownerRows[0].endpoint, endpoint)
    assert.equal(ownerRows[0].keys.auth, 'b')
  },
)
