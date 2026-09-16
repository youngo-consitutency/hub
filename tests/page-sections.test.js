import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PAGE_SECTIONS,
  pageSectionFor,
  navigationActive,
} from '../src/lib/pageSections.js'

test('only the three close member pairs share a navigation destination', () => {
  for (const [path, href] of [
    ['/directory', '/directory/people'],
    ['/platform', '/groups'],
    ['/groups/ace', '/groups'],
    ['/submissions/example', '/submissions'],
    ['/gys', '/submissions'],
    ['/team/membership/renewals', '/team/membership'],
  ])
    assert.equal(navigationActive(path, href), true, path)
  assert.equal(navigationActive('/council/example', '/work'), false)
  assert.equal(navigationActive('/coys/example', '/calendar'), false)
  for (const name of ['people', 'groups', 'policy'])
    assert.equal(PAGE_SECTIONS[name].items.length, 2)
})

test('page switches select one specific view and unrelated pages remain direct', () => {
  assert.equal(pageSectionFor('/directory/people').href, '/directory/people')
  assert.equal(
    pageSectionFor('/staff/review/opportunities').href,
    '/staff/review/opportunities',
  )
  assert.equal(
    pageSectionFor('/team/membership/renewals').href,
    '/team/membership/renewals',
  )
  for (const path of ['/work', '/calendar', '/coys', '/council', '/resources'])
    assert.equal(pageSectionFor(path), null)
  assert.equal(navigationActive('/groups-extra', '/groups'), false)
})

test('restricted partnerships stay outside the group pair', () => {
  assert.equal(pageSectionFor('/platform/partnerships'), null)
  assert.equal(navigationActive('/platform/partnerships', '/platform'), false)
  assert.equal(navigationActive('/platform/partnerships', '/groups'), false)
  assert.equal(
    navigationActive('/platform/partnerships', '/platform/partnerships'),
    true,
  )
  assert.equal(navigationActive('/work', '/'), false)
})
