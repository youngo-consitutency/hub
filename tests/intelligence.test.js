import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { intelligenceRouter } from '../server/routes/intelligence.js'
import { getAccessProfile, hasCapability } from '../server/lib/access.js'
import {
  INTELLIGENCE_FIELD_POLICY,
  buildPublicEvidence,
  buildPrivateEvidence,
  queryIntelligence,
  retrieveEvidence,
  validateWritebackPayload,
  canApproveWriteback,
} from '../server/lib/intelligence.js'

test('public adapter emits stable, source-attributed envelopes without prohibited account fields', () => {
  const first = buildPublicEvidence()
  const second = buildPublicEvidence()
  assert.ok(first.length > 10)
  assert.deepEqual(
    first.map((x) => x.id),
    second.map((x) => x.id),
  )
  assert.ok(
    first.every(
      (x) => x.id.startsWith('youngo-hub:') && x.source === 'youngo-hub',
    ),
  )
  const serialized = JSON.stringify(first)
  for (const field of [
    'password_hash',
    'password_salt',
    'session_token',
    'guardian_email',
    'minority_groups',
    'private_messages',
  ])
    assert.equal(serialized.includes(field), false)
})

test('member scope only adds own assignment context while mandate scope may add contact channels', async () => {
  const member = {
    id: 'member-1',
    role: 'member',
    teamRoles: [],
    wgInterests: [],
  }
  const memberAccess = await getAccessProfile(member)
  const memberEvidence = buildPrivateEvidence({
    account: member,
    access: memberAccess,
  })
  assert.equal(memberEvidence.length, 1)
  assert.equal(memberEvidence[0].audience, 'member')
  assert.equal(
    memberEvidence.some((x) => x.metadata.memberContact),
    false,
  )

  const contact = {
    id: 'contact-1',
    role: 'wg_contact',
    teamRoles: [],
    wgInterests: ['finance'],
  }
  const contactAccess = await getAccessProfile(contact)
  const contactEvidence = buildPrivateEvidence({
    account: contact,
    access: contactAccess,
  })
  assert.equal(hasCapability(contactAccess, 'intelligence.contacts.read'), true)
  assert.equal(
    contactEvidence.some(
      (x) => x.audience === 'mandate' && x.metadata.memberContact,
    ),
    true,
  )
})

test('retrieval and synthesis retain inspectable citation IDs', () => {
  const evidence = buildPublicEvidence()
  const ranked = retrieveEvidence(
    'upcoming climate finance working group meeting',
    evidence,
    { limit: 5 },
  )
  assert.ok(ranked.length > 0)
  assert.ok(ranked.every((x) => x.score > 0 && x.signals.length > 0))
  const result = queryIntelligence({
    query: 'upcoming climate finance working group meeting',
    limit: 5,
  })
  assert.equal(result.audience, 'public')
  assert.deepEqual(
    result.synthesis.citations.map((x) => x.evidenceId),
    result.evidence.slice(0, 5).map((x) => x.id),
  )
  assert.match(result.synthesis.caveat, /verify/i)
})

test('field policy explicitly excludes sensitive account and message material', () => {
  const excluded = new Set(INTELLIGENCE_FIELD_POLICY.alwaysExcluded)
  for (const field of [
    'password_hash',
    'session_token',
    'date_of_birth',
    'guardian_email',
    'minority_groups',
    'private_messages',
    'raw_account_record',
  ])
    assert.equal(excluded.has(field), true)
})

test('writebacks accept only cited research notes and enforce separation of duties', () => {
  assert.equal(
    validateWritebackPayload({
      action: 'change_member_role',
      title: 'No',
      body: 'This must never be allowed',
      citations: ['x'],
    }).ok,
    false,
  )
  assert.equal(
    validateWritebackPayload({
      action: 'save_research_note',
      title: 'COP evidence',
      body: 'A reviewable evidence-backed research note.',
      citations: ['youngo-hub:event:abc'],
    }).ok,
    true,
  )
  assert.equal(
    canApproveWriteback(
      { status: 'proposed', proposedBy: 'admin-a' },
      'admin-a',
    ),
    false,
  )
  assert.equal(
    canApproveWriteback(
      { status: 'proposed', proposedBy: 'admin-a' },
      'admin-b',
    ),
    true,
  )
})

test('non-admin is denied approval capability and unauthenticated private query is rejected', async () => {
  const access = await getAccessProfile({
    id: 'member-1',
    role: 'member',
    teamRoles: [],
    wgInterests: [],
  })
  assert.equal(hasCapability(access, 'intelligence.writeback.approve'), false)
  const app = express()
  app.use(express.json())
  app.use('/api/intelligence', intelligenceRouter)
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/intelligence/query`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'private working group contact' }),
      },
    )
    assert.equal(response.status, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
