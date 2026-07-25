import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateContent } from '../shared/contentValidation.js'

const fixtureFile = new URL('../data/fixtures.json', import.meta.url)

test('the checked-in Hub content passes validation', async () => {
  const content = JSON.parse(await readFile(fixtureFile, 'utf8'))
  assert.deepEqual(validateContent(content), [])
})

test('content validation reports common editing mistakes', () => {
  const content = {
    groups: [{ slug: 'finance' }],
    events: [
      { slug: 'call', title: '', type: 'meeting', wg: 'missing', meetingUrl: 'zoom dot us' },
      { slug: 'call', title: 'Second call', type: 'wg_call' },
    ],
    submissions: [],
    council: [],
    coys: [],
    announcements: [],
    directory: [{ group: 'leaders', roleTitle: '', description: '' }],
  }

  const errors = validateContent(content)
  assert.ok(errors.some((error) => error.includes('duplicate slug')))
  assert.ok(errors.some((error) => error.includes('type "meeting"')))
  assert.ok(errors.some((error) => error.includes('does not match a group slug')))
  assert.ok(errors.some((error) => error.includes('full http:// or https:// URL')))
  assert.ok(errors.some((error) => error.includes('group "leaders"')))
})
