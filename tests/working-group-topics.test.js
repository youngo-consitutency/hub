import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WORKING_GROUPS,
  WORKING_GROUP_TOPICS,
  workingGroupTopic,
} from '../shared/workingGroups.js'

test('broad topics cover every working group exactly once', () => {
  const groupedSlugs = WORKING_GROUP_TOPICS.flatMap((topic) => topic.groups)
  const knownSlugs = WORKING_GROUPS.map((group) => group.slug)

  assert.equal(new Set(groupedSlugs).size, groupedSlugs.length)
  assert.deepEqual([...groupedSlugs].sort(), [...knownSlugs].sort())

  for (const group of WORKING_GROUPS) {
    const topic = workingGroupTopic(group.slug)
    assert.ok(topic, `${group.slug} should have a visible filter topic`)
    assert.ok(topic.groups.includes(group.slug))
  }
})
