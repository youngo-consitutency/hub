import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTicketInput } from '../server/lib/feedback.js'
import { githubIssuesConfig } from '../server/lib/githubIssues.js'

const valid = { kind: 'bug', title: 'Calendar filter resets on back' }

describe('feedback ticket input', () => {
  it('keeps a well-formed report and defaults the severity', () => {
    const ticket = normalizeTicketInput({ ...valid, body: 'Steps: …' })
    assert.equal(ticket.kind, 'bug')
    assert.equal(ticket.severity, 'normal')
    assert.equal(ticket.title, 'Calendar filter resets on back')
    assert.equal(ticket.body, 'Steps: …')
  })

  it('rejects a title too short to triage', () => {
    assert.throws(() => normalizeTicketInput({ ...valid, title: 'help' }), {
      code: 'validation',
    })
  })

  it('rejects unknown kinds and severities rather than storing them', () => {
    assert.throws(() => normalizeTicketInput({ ...valid, kind: 'urgent' }), {
      code: 'validation',
    })
    assert.throws(
      () => normalizeTicketInput({ ...valid, severity: 'apocalyptic' }),
      { code: 'validation' },
    )
  })

  it('stores only same-origin page paths', () => {
    assert.equal(
      normalizeTicketInput({ ...valid, pagePath: '/calendar?type=all' })
        .pagePath,
      '/calendar?type=all',
    )
    // A crafted payload must not turn the triage queue into an outbound link.
    for (const hostile of [
      'https://evil.example/phish',
      'javascript:alert(1)',
      '//evil.example',
    ]) {
      assert.equal(
        normalizeTicketInput({ ...valid, pagePath: hostile }).pagePath,
        null,
        `${hostile} must not be stored as a page path`,
      )
    }
  })

  it('keeps the viewport only when it is a plain WxH pair', () => {
    assert.equal(
      normalizeTicketInput({ ...valid, viewport: '1280x800' }).viewport,
      '1280x800',
    )
    assert.equal(
      normalizeTicketInput({ ...valid, viewport: 'huge' }).viewport,
      null,
    )
  })

  it('truncates an over-long body instead of rejecting the report', () => {
    const ticket = normalizeTicketInput({ ...valid, body: 'x'.repeat(9000) })
    assert.equal(ticket.body.length, 4000)
  })
})

describe('github issue mirroring config', () => {
  it('stays off until both the token and a well-formed repo are set', () => {
    assert.equal(githubIssuesConfig({}), null)
    assert.equal(githubIssuesConfig({ GITHUB_ISSUE_TOKEN: 't' }), null)
    assert.equal(
      githubIssuesConfig({
        GITHUB_ISSUE_TOKEN: 't',
        GITHUB_ISSUE_REPO: 'nope',
      }),
      null,
    )
  })

  it('activates for an owner/repo pair', () => {
    assert.deepEqual(
      githubIssuesConfig({
        GITHUB_ISSUE_TOKEN: 'ghp_x',
        GITHUB_ISSUE_REPO: 'GGG-GYC/youngo-hub',
      }),
      { token: 'ghp_x', repo: 'GGG-GYC/youngo-hub' },
    )
  })
})
