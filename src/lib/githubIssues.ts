import type { Doc } from './domain'

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

// Mirroring is off unless both a token and an owner/repo pair are set.
export function githubIssuesConfig(env: Record<string, string | undefined> = process.env) {
  const token = String(env.GITHUB_ISSUE_TOKEN || '').trim()
  const repo = String(env.GITHUB_ISSUE_REPO || '').trim()
  if (!token || !REPO_RE.test(repo)) return null
  return { token, repo }
}

/** Best-effort copy of a feedback ticket into GitHub Issues; names the reporter by account id only. */
export async function mirrorFeedbackIssue(ticket: Doc, log?: { warn: (entry: object) => void }) {
  const config = githubIssuesConfig()
  if (!config) return null
  const body = [
    `**Kind:** ${ticket.kind}`,
    `**Severity:** ${ticket.severity}`,
    ticket.pageUrl && `**Page:** \`${ticket.pageUrl}\``,
    ticket.viewport && `**Viewport:** ${ticket.viewport}`,
    ticket.userAgent && `**User agent:** ${ticket.userAgent}`,
    `**Hub ticket:** ${ticket.id}`,
    `**Reporter account:** ${typeof ticket.account === 'object' ? ticket.account?.id : ticket.account}`,
    '',
    ticket.body,
  ]
    .filter((line) => line !== null && line !== undefined && line !== false)
    .join('\n')
  try {
    const res = await fetch(`https://api.github.com/repos/${config.repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[${ticket.kind}] ${ticket.title}`,
        body,
        labels: ['hub-feedback', ticket.kind],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
    return ((await res.json()) as { html_url?: string }).html_url || null
  } catch (error) {
    log?.warn({ event: 'hub_feedback_github_mirror_failed', message: String(error) })
    return null
  }
}
