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
  publicSpace: true,
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

test('groups without a public-space opt-in hide comms from anonymous views', () => {
  const result = groupView({
    slug: 'ach',
    name: 'Arts, Culture and Heritage',
    publicSpace: false,
    focusLine: 'Culture in climate action',
    cadenceNote: 'Weekly',
    events: [event],
    resources: [
      { label: 'Culture Global Stocktake', url: 'https://example.org/cgst' },
    ],
    taskForces: [{ slug: 'policy', name: 'Policy', purpose: 'Inputs' }],
  })
  assert.equal(result.publicSpace, false)
  assert.equal(result.focusLine, undefined)
  assert.equal(result.events, undefined)
  assert.equal(result.resources, undefined)
  assert.equal(result.taskForces, undefined)
})

test('signed-in members still see a members-only group page', () => {
  const result = groupView(
    {
      slug: 'ach',
      name: 'Arts, Culture and Heritage',
      publicSpace: false,
      focusLine: 'Culture in climate action',
      events: [event],
    },
    { includePrivate: true },
  )
  assert.equal(result.focusLine, 'Culture in climate action')
  assert.equal(result.events[0].title, event.title)
})

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

test('verified members retain event links but group resources require an unlocked workspace', () => {
  assert.equal(
    eventView(event, { includePrivate: true }).meetingUrl,
    event.meetingUrl,
  )
  assert.equal(
    groupView(group, { includePrivate: true }).whatsappUrl,
    undefined,
  )
  assert.equal(
    groupView(group, {
      includePrivate: true,
      includeWorkspace: true,
    }).whatsappUrl,
    group.whatsappUrl,
  )
})

test('join links quoted in prose are redacted, registration links are kept', () => {
  const quoted = eventView({
    slug: 'ace-call',
    description:
      'Latest Meet link: https://meet.google.com/tjp-fcrx-vjt. Register at https://us06web.zoom.us/meeting/register/abc123.',
  })
  assert.doesNotMatch(quoted.description, /meet\.google\.com/)
  assert.match(quoted.description, /members-only link/)
  // A registration page is published on purpose — newcomers need it.
  assert.match(quoted.description, /zoom\.us\/meeting\/register/)
  assert.equal(
    eventView(
      { slug: 'ace-call', description: 'Meet: https://meet.google.com/abc' },
      { includePrivate: true },
    ).description,
    'Meet: https://meet.google.com/abc',
  )
})

test('WhatsApp invites stay behind the workspace gate', () => {
  const result = groupView({
    slug: 'ach',
    name: 'Arts, Culture and Heritage',
    publicSpace: true,
    whatsappUrl: 'https://chat.whatsapp.com/IS7oIpCYFUG4W07bvGRqh6',
    resources: [
      {
        label: 'WhatsApp — Arts, Culture and Heritage WG',
        url: 'https://chat.whatsapp.com/IS7oIpCYFUG4W07bvGRqh6',
      },
      {
        label: 'Culture Global Stocktake',
        url: 'https://www.cultureglobalstocktake.com/',
      },
    ],
  })
  assert.equal(result.whatsappUrl, undefined)
  assert.deepEqual(
    result.resources.map((resource) => resource.label),
    ['Culture Global Stocktake'],
  )
  assert.equal(result.workspaceResourcesLocked, true)
})

test('locked group resources keep open media and hide member material', () => {
  const result = groupView({
    slug: 'ace',
    name: 'ACE',
    publicSpace: true,
    resources: [
      { label: 'UNFCCC ACE hub', url: 'https://unfccc.int/topics/ace' },
      { label: 'Monthly Meet', url: 'https://meet.google.com/tjp-fcrx-vjt' },
      {
        label: 'Academy register',
        url: 'https://us06web.zoom.us/meeting/register/abc123',
      },
      { label: 'Instagram', url: 'https://instagram.com/ace' },
      { label: 'Shared Drive', url: 'https://drive.google.com/ace' },
    ],
  })
  assert.deepEqual(
    result.resources.map((resource) => resource.label),
    ['UNFCCC ACE hub', 'Instagram'],
  )
  assert.equal(result.workspaceResourcesLocked, true)
})

test('an unlocked group view returns the complete member resource set', () => {
  const resources = [
    { label: 'Instagram', url: 'https://instagram.com/ace' },
    { label: 'Join form', url: 'https://airtable.com/ace' },
    { label: 'Shared Drive', url: 'https://drive.google.com/ace' },
  ]
  const result = groupView(
    { slug: 'ace', name: 'ACE', resources },
    { includePrivate: true, includeWorkspace: true },
  )

  assert.deepEqual(result.resources, resources)
  assert.equal(result.workspaceResourcesLocked, false)
})

test('feed and search sanitization covers nested event and group objects', () => {
  assert.equal(
    feedView({ live: event, week: [event] }).live.meetingUrl,
    undefined,
  )
  const result = searchView({
    events: [event],
    groups: [{ ...group, publicSpace: true }],
    contacts: [group.contact],
  })
  assert.equal(result.events[0].meetingUrl, undefined)
  assert.equal(result.groups[0].whatsappUrl, undefined)
  assert.equal(result.contacts[0].personName, undefined)
})
