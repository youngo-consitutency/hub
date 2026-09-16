import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { canonicalResourceUrl } from '../shared/resourceHub.js'
import { validateEditableContent } from '../shared/contentValidation.js'

const resources = JSON.parse(
  readFileSync(new URL('../data/resource-hub.json', import.meta.url)),
)
const manifest = JSON.parse(
  readFileSync(new URL('../data/resource-import.json', import.meta.url)),
)

test('every imported source URL is present exactly once with provenance and valid tags', () => {
  const urls = resources.map((r) => canonicalResourceUrl(r.url))
  assert.equal(new Set(urls).size, resources.length)
  assert.equal(manifest.sourceCount, manifest.sourceUrls.length)
  for (const url of manifest.sourceUrls) {
    const item = resources.find((r) => canonicalResourceUrl(r.url) === url)
    assert.ok(item, url)
    assert.equal(item.source.commit, manifest.commit)
    assert.equal(validateEditableContent('resource', item).ok, true)
  }
  assert.equal(
    canonicalResourceUrl('https://example.org/?utm_source=mail&b=2&a=1'),
    'https://example.org/?a=1&b=2',
  )
  assert.throws(() => canonicalResourceUrl('https://user:secret@example.org'))
  assert.throws(() => canonicalResourceUrl('javascript:alert(1)'))
  assert.equal(
    validateEditableContent('resource', {
      ...resources[0],
      topics: ['Invented tag'],
    }).ok,
    false,
  )
  assert.equal(
    validateEditableContent('resource', {
      ...resources[0],
      url: 'https://user:secret@example.org',
    }).ok,
    false,
  )
})

test(
  'resource reports, independent verification, corrections, and retirement are governed end to end',
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    const { getPool } = await import('../server/lib/db.js')
    const { createSession } = await import('../server/lib/accounts.js')
    const { createApp } = await import('../server/app.js')
    const pool = getPool()
    const member = randomUUID(),
      publisher = randomUUID(),
      editor = randomUUID()
    const actors = [member, publisher, editor]
    const resource = resources.find((r) => r.source)
    const slug = `resource-test-${randomUUID()}`
    const server = createApp({ env: { NODE_ENV: 'test' } }).listen(
      0,
      '127.0.0.1',
    )
    await new Promise((resolve) => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const tokens = {}
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve))
      await pool.query(
        'DELETE FROM resource_issues WHERE reported_by=ANY($1::uuid[])',
        [actors],
      )
      await pool.query(
        'DELETE FROM resource_reviews WHERE reviewed_by=ANY($1::uuid[])',
        [actors],
      )
      await pool.query(
        "DELETE FROM hub_content_publications WHERE content_type='resource' AND (content_key=$1 OR published_by=ANY($2::uuid[]))",
        [resource.slug, actors],
      )
      await pool.query(
        'DELETE FROM hub_content_revisions WHERE created_by=ANY($1::uuid[])',
        [actors],
      )
      await pool.query(
        'DELETE FROM governance_audit WHERE actor_id=ANY($1::uuid[])',
        [actors],
      )
      await pool.query('DELETE FROM hub_accounts WHERE id=ANY($1::uuid[])', [
        actors,
      ])
      await pool.end()
    })
    for (const id of actors) {
      await pool.query(
        `INSERT INTO hub_accounts(id,email,password_hash,password_salt,name,entity_type,membership_track,country,membership_policy_version,role,member_status,hub_access_status,membership_status,constituency_work_status,course_passed_at,email_verified_at) VALUES($1,$2,'unused','unused','Resource test','individual','constituency_work','Kenya','test','member','verified','active','active','active',now(),now())`,
        [id, `${id}@example.org`],
      )
      tokens[id] = (await createSession(id)).token
    }
    for (const [id, role] of [
      [publisher, 'content_publisher'],
      [editor, 'content_editor'],
    ])
      await pool.query(
        "INSERT INTO account_assignments(account_id,scope_type,scope_id,role) VALUES($1,'team',$2,'member')",
        [id, role],
      )
    async function call(actor, path, body, expected = 200) {
      const response = await fetch(`${origin}/api${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          ...(actor ? { 'x-session-token': tokens[actor] } : {}),
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const data = await response.json()
      assert.equal(
        response.status,
        expected,
        `${path}: ${JSON.stringify(data).slice(0, 800)}`,
      )
      return data
    }
    const publicItems = async () => (await call(null, '/resources')).items
    const current = async () =>
      (await publicItems()).find((r) => r.slug === resource.slug)
    assert.equal((await current()).verification.status, 'needs_verification')
    await call(null, '/member/resources/issues', null, 401)
    await call(member, '/member/resources/issues', null, 403)
    await call(editor, '/member/resources/issues', null, 403)
    const report = await call(
      member,
      `/member/resources/${resource.slug}/issues`,
      { kind: 'tags', detail: 'PRIVATE REPORT: the tags need inspection' },
      201,
    )
    await call(
      member,
      `/member/resources/${resource.slug}/issues`,
      { kind: 'broken', detail: 'Another duplicate report' },
      409,
    )
    assert.equal((await current()).verification.openIssues, 1)
    assert.equal(
      JSON.stringify(await publicItems()).includes('PRIVATE REPORT'),
      false,
    )
    const queue = await call(publisher, '/member/resources/issues')
    assert.ok(queue.issues.some((issue) => issue.id === report.item.id))
    const review = {
      fingerprint: (await current()).fingerprint,
      status: 'verified',
      note: 'PRIVATE REVIEW: opened destination and checked taxonomy',
      checks: { link: true, description: true, tags: true },
      resolvedIssueIds: [report.item.id],
    }
    await call(member, `/member/resources/${resource.slug}/verify`, review, 403)
    await call(editor, `/member/resources/${resource.slug}/verify`, review, 403)
    await call(
      publisher,
      `/member/resources/${resource.slug}/verify`,
      { ...review, checks: {} },
      400,
    )
    await call(
      publisher,
      `/member/resources/${resource.slug}/verify`,
      { ...review, fingerprint: 'stale' },
      409,
    )
    await call(publisher, `/member/resources/${resource.slug}/verify`, review)
    assert.equal((await current()).verification.status, 'verified')
    assert.equal((await current()).verification.openIssues, 0)
    assert.equal(
      JSON.stringify(await publicItems()).includes('PRIVATE REVIEW'),
      false,
    )
    const newer = await call(
      editor,
      `/member/resources/${resource.slug}/issues`,
      {
        kind: 'outdated',
        detail: 'A newer report that this review has not resolved',
      },
      201,
    )
    await call(publisher, `/member/resources/${resource.slug}/verify`, review)
    assert.equal(
      (await current()).verification.openIssues,
      1,
      'A review must not close an unseen report',
    )
    await call(publisher, `/member/resources/${resource.slug}/verify`, {
      ...review,
      status: 'needs_changes',
      resolvedIssueIds: [newer.item.id],
    })
    assert.equal((await current()).verification.openIssues, 1)
    await call(publisher, `/member/resources/${resource.slug}/verify`, {
      ...review,
      status: 'retired',
      resolvedIssueIds: [newer.item.id],
    })
    assert.equal(await current(), undefined)
    assert.ok(
      (await call(publisher, '/member/resources/issues')).items.some(
        (r) => r.slug === resource.slug && r.verification.status === 'retired',
      ),
    )
    await call(publisher, `/member/resources/${resource.slug}/verify`, review)

    const correction = (
      await call(
        publisher,
        `/member/resources/${resource.slug}/corrections`,
        {
          ...resource,
          summary:
            'A revised public description checked for relevance to climate science.',
        },
        201,
      )
    ).item
    await call(
      publisher,
      `/member/content/drafts/${correction.id}/review`,
      { decision: 'approve' },
      409,
    )
    await pool.query(
      "INSERT INTO account_assignments(account_id,scope_type,scope_id,role) VALUES($1,'team','content_publisher','member')",
      [editor],
    )
    await call(editor, `/member/content/drafts/${correction.id}/review`, {
      decision: 'approve',
      note: 'Independent review of the proposed correction',
    })
    await call(editor, `/member/content/drafts/${correction.id}/publish`, {})
    assert.equal(
      (await current()).verification.status,
      'needs_verification',
      'Content changes invalidate past link checks',
    )
    await call(
      publisher,
      `/member/resources/${resource.slug}/verify`,
      { ...review, fingerprint: (await current()).fingerprint },
      409,
    )
    await call(editor, `/member/resources/${resource.slug}/verify`, {
      ...review,
      fingerprint: (await current()).fingerprint,
    })
    await call(member, '/member/resources/submissions', { ...resource }, 409)
    const submitted = (
      await call(
        member,
        '/member/resources/submissions',
        { ...resource, slug, title: slug, url: `https://example.org/${slug}` },
        201,
      )
    ).item
    assert.equal(
      (await publicItems()).some((r) => r.slug === submitted.contentKey),
      false,
    )
    await call(editor, `/member/content/drafts/${submitted.id}/review`, {
      decision: 'request_changes',
      note: 'Please add a more specific explanation of this resource.',
    })
    assert.equal(
      (await call(member, '/member/resources/submissions/mine')).items.find(
        (i) => i.id === submitted.id,
      ).status,
      'changes_requested',
    )
    const audits = await pool.query(
      "SELECT action FROM governance_audit WHERE actor_id=ANY($1::uuid[]) AND action LIKE 'resource.%'",
      [actors],
    )
    assert.ok(audits.rows.some((a) => a.action === 'resource.verified_review'))
    assert.ok(audits.rows.some((a) => a.action === 'resource.issue_reported'))
    await pool.query(
      "UPDATE hub_content_publications SET status='unpublished' WHERE content_type='resource' AND content_key=$1",
      [resource.slug],
    )
    assert.equal(
      await current(),
      undefined,
      'Unpublishing must not resurrect the imported baseline',
    )
  },
)
