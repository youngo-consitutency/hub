import test from 'node:test'
import assert from 'node:assert/strict'
import {
  eventView,
  groupView,
  feedView,
  searchView,
} from '../server/lib/publicViews.js'

const event = {
  slug: 'finance-call',
  title: 'Finance call',
  meetingUrl: 'https://meet.example/private',
}

const group = {
  slug: 'finance',
  name: 'Finance',
  whatsappUrl: 'https://chat.example/private',
  groupUrl: 'https://groups.example/private',
  driveUrl: 'https://drive.example/private',
  events: [event],
  contact: {
    roleTitle: 'Contact',
    publicEmail: 'finance@example.org',
    personName: 'Private Person',
    channelValue: '@private',
  },
}

test('anonymous event and group views omit member-private links', () => {
  assert.equal(eventView(event).meetingUrl, undefined)
  const result = groupView(group)
  assert.equal(result.whatsappUrl, undefined)
  assert.equal(result.groupUrl, undefined)
  assert.equal(result.driveUrl, undefined)
  assert.equal(result.events[0].meetingUrl, undefined)
  assert.equal(result.contact.personName, undefined)
  assert.equal(result.contact.channelValue, undefined)
})

test('verified member views retain private event and group fields', () => {
  assert.equal(eventView(event, { includePrivate: true }).meetingUrl, event.meetingUrl)
  assert.equal(groupView(group, { includePrivate: true }).whatsappUrl, group.whatsappUrl)
})

test('feed and search sanitization covers nested event and group objects', () => {
  assert.equal(feedView({ live: event, week: [event] }).live.meetingUrl, undefined)
  const result = searchView({ events: [event], groups: [group], contacts: [group.contact] })
  assert.equal(result.events[0].meetingUrl, undefined)
  assert.equal(result.groups[0].whatsappUrl, undefined)
  assert.equal(result.contacts[0].personName, undefined)
})

