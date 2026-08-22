import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WORKING_GROUPS,
  WORKING_GROUP_TOPICS,
} from '../shared/workingGroups.js'

test('broad topics cover every working group exactly once', () => {
  const groupedSlugs = WORKING_GROUP_TOPICS.flatMap((topic) => topic.groups)
  const knownSlugs = WORKING_GROUPS.map((group) => group.slug)

  assert.equal(new Set(groupedSlugs).size, groupedSlugs.length)
  assert.deepEqual([...groupedSlugs].sort(), [...knownSlugs].sort())
})
