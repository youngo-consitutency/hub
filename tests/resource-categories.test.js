import assert from 'node:assert/strict'
import test from 'node:test'

import {
  groupResourcesByCategory,
  isPublicGroupResource,
  resourceCategory,
} from '../shared/resourceCategories.js'

test('working-group resources resolve to one stable purpose', () => {
  const resources = [
    { label: 'Join form', url: 'https://airtable.com/example/form' },
    { label: 'Instagram', url: 'https://instagram.com/example' },
    { label: 'Shared Drive', url: 'https://drive.google.com/folder/example' },
    { label: 'Policy brief', url: 'https://example.org/policy.pdf' },
  ]

  assert.deepEqual(resources.map(resourceCategory), [
    'join',
    'channels',
    'workspace',
    'reference',
  ])
})

test('resource groups keep a predictable order and omit empty sections', () => {
  const groups = groupResourcesByCategory([
    { label: 'Shared Drive', url: 'https://drive.google.com/folder/example' },
    { label: 'WhatsApp channel', url: 'https://chat.whatsapp.com/example' },
    { label: 'Research dashboard', url: 'https://example.org/dashboard' },
  ])

  assert.deepEqual(
    groups.map(({ key }) => key),
    ['channels', 'workspace', 'reference'],
  )
})

test('a Linktree stays a channel when its description mentions forms', () => {
  assert.equal(
    resourceCategory({
      label: 'Finance & Markets Linktree',
      description: 'Drive, minutes, WhatsApp, join form, and LinkedIn.',
      url: 'https://linktr.ee/finance_and_markets_wg_youngo',
    }),
    'channels',
  )
})

test('only open references and public social media bypass the workspace gate', () => {
  const resources = [
    { label: 'Instagram', url: 'https://instagram.com/example' },
    { label: 'LinkedIn', url: 'https://linkedin.com/company/example' },
    { label: 'Research dashboard', url: 'https://example.org/dashboard' },
    { label: 'Link hub', url: 'https://linktr.ee/example' },
    { label: 'WhatsApp channel', url: 'https://chat.whatsapp.com/example' },
    { label: 'Join form', url: 'https://airtable.com/example/form' },
    { label: 'Shared Drive', url: 'https://drive.google.com/folder/example' },
  ]

  assert.deepEqual(resources.map(isPublicGroupResource), [
    true,
    true,
    true,
    false,
    false,
    false,
    false,
  ])
})
