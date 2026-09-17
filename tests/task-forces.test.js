import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  DEFAULT_TASK_FORCES,
  normalizeTaskForces,
  taskForceBySlug,
} from '../shared/taskForces.js'
import { getGroup } from '../server/lib/store.js'

const fixtureFile = new URL('../data/fixtures.json', import.meta.url)

test('ACH publishes programming, policy, and events-partnerships task forces', async () => {
  const content = JSON.parse(await readFile(fixtureFile, 'utf8'))
  const ach = content.groups.find((group) => group.slug === 'ach')
  const forces = normalizeTaskForces(ach.taskForces, 'ach')
  assert.deepEqual(
    forces.map((item) => item.slug),
    ['programming', 'policy', 'events-partnerships'],
  )
  assert.equal(ach.publicSpace, false)
  assert.equal(
    taskForceBySlug(ach, 'events-partnerships').name,
    'Events and partnerships',
  )
})

test('unknown task-force slugs are dropped', () => {
  assert.deepEqual(
    normalizeTaskForces(
      [{ slug: 'secret', name: 'Secret' }, DEFAULT_TASK_FORCES.ach[0]],
      'ach',
    ).map((item) => item.slug),
    ['programming'],
  )
})

test('getGroup exposes ACH task forces to signed-in group pages', () => {
  const group = getGroup('ach')
  assert.equal(group.publicSpace, false)
  assert.equal(group.taskForces.length, 3)
})
