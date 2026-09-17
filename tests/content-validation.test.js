import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateContent } from '../shared/contentValidation.js'
import { resolveCoyStatus } from '../shared/coyStatus.js'

const fixtureFile = new URL('../data/fixtures.json', import.meta.url)

test('the checked-in Hub content passes validation', async () => {
  const content = JSON.parse(await readFile(fixtureFile, 'utf8'))
  assert.deepEqual(validateContent(content), [])
})

test('COY21 delegate applications record a close timestamp', async () => {
  const content = JSON.parse(await readFile(fixtureFile, 'utf8'))
  const applyUrl =
    'https://docs.google.com/forms/d/e/1FAIpQLSczcCs1LIiua67wsR6kZN2yIzRo7Now-dSIPiZkwdscZHvNqg/viewform'
  const coy = content.coys.find((item) => item.slug === 'coy21')
  const opportunity = content.opportunities.find(
    (item) => item.slug === 'coy21-delegates-eoi-2026',
  )
  const announcement = content.announcements.find(
    (item) => item.slug === 'coy21-delegates-eoi-2026',
  )
  const afterClose = new Date('2026-09-16T13:00:00.000Z')

  assert.equal(coy.status, 'applications_open')
  assert.equal(coy.applicationsCloseAt, '2026-09-05T23:59:00.000Z')
  assert.equal(resolveCoyStatus(coy, afterClose), 'applications_closed')
  assert.equal(coy.startsOn, '2026-11-05')
  assert.equal(coy.endsOn, '2026-11-07')
  assert.equal(coy.datesTbc, false)
  assert.equal(coy.registerUrl, applyUrl)
  assert.equal(opportunity.kind, 'call')
  assert.equal(opportunity.format, 'in_person')
  assert.equal(opportunity.deadlineAt, '2026-09-05T23:59:00.000Z')
  assert.equal(opportunity.linkUrl, applyUrl)
  assert.equal(announcement.pinned, false)
  assert.equal(announcement.ctaUrl, applyUrl)
  assert.equal(announcement.ctaDeadlineAt, '2026-09-05T23:59:00.000Z')
})

test('content validation reports common editing mistakes', () => {
  const content = {
    groups: [{ slug: 'finance' }],
    events: [
      {
        slug: 'call',
        title: '',
        type: 'meeting',
        wg: 'missing',
        meetingUrl: 'zoom dot us',
      },
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
  assert.ok(
    errors.some((error) => error.includes('does not match a group slug')),
  )
  assert.ok(
    errors.some((error) => error.includes('full http:// or https:// URL')),
  )
  assert.ok(errors.some((error) => error.includes('group "leaders"')))
})
