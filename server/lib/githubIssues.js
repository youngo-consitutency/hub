// Optional mirroring of feedback tickets into GitHub issues.
//
// Opt-in: without GITHUB_ISSUE_TOKEN and GITHUB_ISSUE_REPO the Hub simply keeps
// tickets in its own queue. Mirroring is best-effort — a GitHub outage must
// never lose a member's report, so every failure is logged and swallowed.
const API = 'https://api.github.com'

export function githubIssuesConfig(env = process.env) {
  const token = String(env.GITHUB_ISSUE_TOKEN || '').trim()
  const repo = String(env.GITHUB_ISSUE_REPO || '').trim()
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null
  return { token, repo }
}

function issueBody(ticket, reporter) {
  const lines = [
    ticket.body || '_No description given._',
    '',
    '---',
    `- **Type:** ${ticket.kind}`,
    `- **Severity:** ${ticket.severity}`,
    `- **Page:** ${ticket.pagePath || 'not captured'}`,
    `- **Viewport:** ${ticket.viewport || 'not captured'}`,
    `- **User agent:** ${ticket.userAgent || 'not captured'}`,
    `- **Hub ticket:** ${ticket.id}`,
  ]
  // Reporter identity stays in the Hub. A public repo issue gets the account id
  // only, which the team can resolve in the triage queue.
  if (reporter?.id)
    lines.push(`- **Reported by (Hub account):** ${reporter.id}`)
  return lines.join('\n')
}

export async function createGithubIssue(ticket, reporter, env = process.env) {
  const config = githubIssuesConfig(env)
  if (!config) return null
  try {
    const res = await fetch(`${API}/repos/${config.repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'youngo-hub-feedback',
      },
      body: JSON.stringify({
        title: `[${ticket.kind}] ${ticket.title}`,
        body: issueBody(ticket, reporter),
        labels: ['hub-feedback', ticket.kind],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('github issue mirror failed:', res.status)
      return null
    }
    const data = await res.json()
    return data.html_url || null
  } catch (error) {
    console.error('github issue mirror error:', error.message)
    return null
  }
}
