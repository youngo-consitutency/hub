import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { WG_ACTIVITY_KIND_VALUES } from '../shared/workflows.js'

test('working-group activity choices stay compatible with the database', async () => {
  const migration = await readFile(new URL('../migrations/006_member_lifecycle.sql', import.meta.url), 'utf8')
  assert.deepEqual(WG_ACTIVITY_KIND_VALUES, ['call', 'submission', 'campaign', 'action_point'])
  for (const kind of WG_ACTIVITY_KIND_VALUES) {
    assert.match(migration, new RegExp(`'${kind}'`))
  }
})
