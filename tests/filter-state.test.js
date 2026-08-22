import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeFilterCount,
  matchesFilters,
  nextFilterState,
  toggleFilter,
} from '../src/lib/filterState.js'

test('filter options cycle through include, exclude, and neutral', () => {
  assert.equal(nextFilterState(), 'include')
  assert.equal(nextFilterState('include'), 'exclude')
  assert.equal(nextFilterState('exclude'), 'neutral')
})

test('multiple includes and excludes compose predictably', () => {
  const filters = {
    adaptation: 'include',
    energy: 'include',
    health: 'exclude',
  }
  assert.equal(matchesFilters('adaptation', filters), true)
  assert.equal(matchesFilters('energy', filters), true)
  assert.equal(matchesFilters('health', filters), false)
  assert.equal(matchesFilters('nature', filters), false)
  assert.equal(activeFilterCount(filters), 3)
})

test('toggling back to neutral removes the option', () => {
  const included = toggleFilter({}, 'energy')
  const excluded = toggleFilter(included, 'energy')
  const cleared = toggleFilter(excluded, 'energy')
  assert.deepEqual(cleared, {})
})
