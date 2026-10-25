import type { Payload } from 'payload'
import { describe, it, beforeAll, expect } from 'vitest'

import { feedbackContext } from '../../src/endpoints/feedback'
import { githubIssuesConfig } from '../../src/lib/githubIssues'
import { callHubContentTool, createHubClient } from '../../mcp-content/lib/client.mjs'
import { testPayload } from './provision'
import { BASE, api, session } from './helpers'

describe('feedback context', () => {
  it('keeps a same-origin path and drops hostile ones', () => {
    expect(feedbackContext({ pagePath: '/groups/energy?tab=1' }).pageUrl).toBe(
      '/groups/energy?tab=1',
    )
    for (const pagePath of ['https://evil.test/x', 'javascript:alert(1)', '//evil.test']) {
      expect(feedbackContext({ pagePath }).pageUrl).toBeNull()
    }
  })

  it('accepts only a WxH viewport', () => {
    expect(feedbackContext({ viewport: '1280x720' }).viewport).toBe('1280x720')
    expect(feedbackContext({ viewport: 'wide' }).viewport).toBeNull()
  })

  it('mirrors to GitHub only with a token and an owner/repo pair', () => {
    expect(githubIssuesConfig({})).toBeNull()
    expect(githubIssuesConfig({ GITHUB_ISSUE_TOKEN: 't' })).toBeNull()
    expect(githubIssuesConfig({ GITHUB_ISSUE_TOKEN: 't', GITHUB_ISSUE_REPO: 'nope' })).toBeNull()
    expect(
      githubIssuesConfig({ GITHUB_ISSUE_TOKEN: 't', GITHUB_ISSUE_REPO: 'owner/repo' }),
    ).toEqual({ token: 't', repo: 'owner/repo' })
  })
})

describe('feedback api', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await testPayload()
  })

  it('stores context, audits submission and triage, and serves the MCP tools', async () => {
    const reporter = await session({})
    const created = await api('/member/feedback', {
      method: 'POST',
      cookie: reporter.cookie,
      body: JSON.stringify({
        title: 'Calendar filter resets',
        kind: 'bug',
        severity: 'normal',
        body: 'Choosing a group resets the month view.',
        pagePath: '/calendar',
        viewport: '390x844',
        userAgent: 'vitest',
      }),
    })
    expect(created.status).toBe(201)
    const { item } = await created.json()
    expect(item).toMatchObject({ pageUrl: '/calendar', viewport: '390x844', userAgent: 'vitest' })

    const audits = async (action: string) =>
      (
        await payload.find({
          collection: 'audit-log',
          where: { action: { equals: action }, targetId: { equals: String(item.id) } },
          overrideAccess: true,
        })
      ).totalDocs
    expect(await audits('feedback.submitted')).toBe(1)

    const denied = await api(`/member/feedback/${item.id}`, {
      method: 'PATCH',
      cookie: reporter.cookie,
      body: JSON.stringify({ status: 'triaged' }),
    })
    expect(denied.status).toBe(403)

    const team = await session({ membershipTrack: 'constituency_work', teams: ['membership_team'] })
    const bad = await api(`/member/feedback/${item.id}`, {
      method: 'PATCH',
      cookie: team.cookie,
      body: JSON.stringify({ status: 'done' }),
    })
    expect(bad.status).toBe(400)
    const missing = await api('/member/feedback/999999999', {
      method: 'PATCH',
      cookie: team.cookie,
      body: JSON.stringify({ status: 'triaged' }),
    })
    expect(missing.status).toBe(404)

    const token = team.cookie.replace('payload-token=', '')
    const client = createHubClient({ origin: BASE, token })
    const listed = await callHubContentTool('list_feedback_tickets', { status: 'new' }, client)
    expect(listed.items.some((t: { id: number }) => t.id === item.id)).toBe(true)
    const triaged = await callHubContentTool(
      'triage_feedback_ticket',
      { id: String(item.id), status: 'triaged', triageNote: 'Reproduced.' },
      client,
    )
    expect(triaged.item).toMatchObject({ status: 'triaged', triageNote: 'Reproduced.' })
    expect(await audits('feedback.triaged')).toBe(1)
  })
})
