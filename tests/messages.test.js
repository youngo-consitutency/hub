import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addMessage,
  canStartConversation,
  findOrCreateConversation,
  listMessageContacts,
} from '../server/lib/messages.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../data')
const files = {
  accounts: path.join(dataDir, 'hub-accounts.json'),
  progress: path.join(dataDir, 'wg-progress.json'),
  conversations: path.join(dataDir, 'message-conversations.json'),
  messages: path.join(dataDir, 'messages.json'),
}
const backups = new Map()

function account(id, role = 'member') {
  return {
    id,
    email: `${id}@example.org`,
    password_hash: 'x',
    password_salt: 'x',
    name: id.replaceAll('-', ' '),
    first_name: id,
    last_name: 'User',
    entity_type: 'individual',
    membership_track: 'constituency_work',
    country: 'Kenya',
    is_unfccc_admitted: false,
    member_status: 'verified',
    role,
    wg_interests: [],
    created_at: new Date().toISOString(),
  }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

beforeEach(() => {
  for (const file of Object.values(files)) {
    backups.set(file, existsSync(file) ? readFileSync(file, 'utf8') : null)
  }
  writeJson(files.accounts, [
    account('regular-a'),
    account('regular-b'),
    account('focal-point', 'focal_point'),
    account('wg-contact', 'wg_contact'),
    account('wg-lead'),
  ])
  writeJson(files.progress, [
    {
      account_id: 'wg-lead',
      wg_slug: 'finance',
      presentation_ok: true,
      rules_ok: true,
      unlocked_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
      role_in_wg: 'lead',
      status: 'active',
    },
  ])
  writeJson(files.conversations, [])
  writeJson(files.messages, [])
})

afterEach(() => {
  for (const [file, content] of backups) {
    if (content == null) rmSync(file, { force: true })
    else writeFileSync(file, content)
  }
  backups.clear()
})

describe('member messaging permissions', () => {
  it('blocks regular members from starting regular member chats', async () => {
    const result = await canStartConversation('regular-a', 'regular-b')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'recipient_not_mandate_holder')
  })

  it('allows members to start chats with global contact points', async () => {
    const result = await findOrCreateConversation('regular-a', 'wg-contact')
    assert.equal(result.ok, true)
    assert.equal(result.conversation.participantA, 'regular-a')
    assert.equal(result.conversation.participantB, 'wg-contact')
  })

  it('treats active WG leads as mandate holders', async () => {
    const result = await canStartConversation('regular-a', 'wg-lead')
    assert.equal(result.ok, true)
    assert.equal(result.recipient.isMandateHolder, true)
  })

  it('allows mandate holders to start chats with other mandate holders', async () => {
    const result = await findOrCreateConversation('focal-point', 'wg-lead')
    assert.equal(result.ok, true)
    assert.equal(result.sender.isMandateHolder, true)
    assert.equal(result.recipient.isMandateHolder, true)
  })

  it('allows members to start chats with focal points', async () => {
    const result = await canStartConversation('regular-a', 'focal-point')
    assert.equal(result.ok, true)
    assert.equal(result.recipient.isMandateHolder, true)
  })

  it('blocks mandate holders from starting regular member chats', async () => {
    const result = await canStartConversation('wg-contact', 'regular-a')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'recipient_not_mandate_holder')
  })

  it('lets participants reply inside an allowed conversation', async () => {
    const started = await findOrCreateConversation('regular-a', 'wg-contact')
    const message = await addMessage(started.conversation.id, 'wg-contact', 'Thanks, I can help.')
    assert.equal(message.body, 'Thanks, I can help.')
    assert.equal(message.senderAccountId, 'wg-contact')
  })

  it('lists only contact points and mandate holders as member contacts', async () => {
    const contacts = await listMessageContacts('regular-a')
    assert.deepEqual(contacts.map((c) => c.id).sort(), ['focal-point', 'wg-contact', 'wg-lead'])
  })
})
