import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  googleCalendarUrl,
  icsDownloadPath,
  outlookWebUrl,
} from '../src/lib/calendarLinks.js'

const sample = {
  slug: 'ace-drafting-session',
  title: 'ACE WG drafting session',
  startsAt: '2026-07-20T15:00:00.000Z',
  endsAt: '2026-07-20T16:00:00.000Z',
  description: 'Draft ACE dialogue topics',
  meetingUrl: 'https://meet.google.com/example-ace',
}

describe('calendar deep links', () => {
  it('builds a Google Calendar TEMPLATE URL with compact UTC dates', () => {
    const url = googleCalendarUrl(sample)
    assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?/)
    assert.match(url, /action=TEMPLATE/)
    assert.match(
      url,
      /dates=20260720T150000Z%2F20260720T160000Z|dates=20260720T150000Z\/20260720T160000Z/,
    )
    assert.match(url, /text=ACE/)
  })

  it('builds an Outlook web compose URL', () => {
    const url = outlookWebUrl(sample)
    assert.match(url, /^https:\/\/outlook\.live\.com\/calendar\//)
    assert.match(url, /rru=addevent/)
    assert.match(url, /subject=/)
  })

  it('returns a relative ICS path for the event slug', () => {
    assert.equal(
      icsDownloadPath(sample.slug),
      '/ics/event/ace-drafting-session.ics',
    )
  })
})
