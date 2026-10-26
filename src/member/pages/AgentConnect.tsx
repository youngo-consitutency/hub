'use client'

import type { AnyValue, Doc } from '../lib/types'
import { useState } from 'react'
import {
  TbCheck as Check,
  TbCopy as Copy,
  TbKey as Key,
  TbLock as Lock,
  TbPlugConnected as Plug,
  TbPoint as Point,
} from 'react-icons/tb'
import { apiPost, useApi } from '../lib/api'
import { formatDateTime } from '../lib/time'
import { useWorkingGroups } from '../lib/workingGroups'
import { A, Async, Button, Empty, ErrorCard, PageHeader, Section } from '../components/ui'
import { FieldError } from '../components/FormControls'

const TOOL_COPY: Record<string, string> = {
  whoami: 'See this account, its role and its groups',
  list_my_groups: 'List the working groups this mandate manages',
  list_wg_activity: 'Read recent activity in those groups',
  add_wg_activity: 'Add a call, submission, campaign or action point',
  list_wg_joiners: 'See joiners’ names, roles and status (no email)',
  constituency_status: 'See contact and member counts per working group',
  mandate_gaps: 'See mandates whose holder cannot act yet (no names)',
}

const GATE_COPY: Record<string, string> = {
  demo: 'Agent keys are switched off on this demo deployment.',
  service_account: 'Service accounts cannot hold a personal agent key.',
  pending_email: 'Confirm the email address on this account, then come back.',
  membership_blocked: 'This membership is not active, so it cannot connect an agent.',
  password_change_required: 'Change your password first — keys are tied to the current one.',
  no_mandate:
    'The connector is for contact points, focal points and Hub operators. The Hub itself stays the member surface.',
}

const ROLE_LABEL: Record<string, string> = {
  operator: 'Hub operator',
  focal_point: 'Focal point',
  contact_point: 'Contact point',
}

const SNIPPETS = {
  claude: (url: string) =>
    `claude mcp add --transport http youngo ${url} \\\n  --header "Authorization: Bearer YOUR_KEY"`,
  cursor: (url: string) =>
    JSON.stringify(
      { mcpServers: { youngo: { url, headers: { Authorization: 'Bearer YOUR_KEY' } } } },
      null,
      2,
    ),
}

export function AgentConnect() {
  const query = useApi('/member/agent')
  return (
    <div>
      <PageHeader
        icon={Plug}
        title="Agent connector"
        description="Let an AI agent work with your Hub mandate through the YOUNGO MCP — with a personal key you can revoke at any time."
      />
      <Async query={query} skeletons={4}>
        {(data: Doc) => <Connector data={data} reload={query.retry} />}
      </Async>
    </div>
  )
}

function Steps({ data, hasKey }: { data: Doc; hasKey: boolean }) {
  const steps = [
    { title: 'Signed in', done: true },
    {
      title: 'Email confirmed',
      done: data.gate !== 'pending_email',
      blocked: data.gate === 'pending_email',
    },
    {
      title: 'Mandate found',
      done: data.eligible,
      blocked: !data.eligible && data.gate !== 'pending_email',
    },
    { title: 'Personal key created', done: hasKey, blocked: !data.eligible },
    { title: 'Agent connected', done: false, blocked: !hasKey },
  ]
  const current = steps.findIndex((s) => !s.done)
  return (
    <ol className="agentSteps">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className={
            step.done ? 'is-done' : i === current ? 'is-current' : step.blocked ? 'is-blocked' : ''
          }
        >
          <span className="agentStepMark" aria-hidden>
            {step.done ? (
              <Check size={14} />
            ) : step.blocked ? (
              <Lock size={14} />
            ) : (
              <Point size={14} />
            )}
          </span>
          <span>{step.title}</span>
        </li>
      ))}
    </ol>
  )
}

function Connector({ data, reload }: { data: Doc; reload: () => void }) {
  const { label } = useWorkingGroups()
  const [password, setPassword] = useState('')
  const [fields, setFields] = useState<Doc>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [secret, setSecret] = useState<Doc | null>(null)
  const [snippet, setSnippet] = useState<'claude' | 'cursor'>('claude')
  const activeKeys = (data.keys || []).filter((k: Doc) => k.state === 'active')
  const url = data.mcpUrl || 'https://<youngo-mcp-host>/mcp'

  const run = async (name: string, task: () => Promise<void>) => {
    setBusy(name)
    setError(null)
    setFields({})
    try {
      await task()
      setPassword('')
    } catch (e) {
      // a failed or refused call never leaves a secret on screen
      setSecret(null)
      setFields((e as AnyValue).fields || {})
      setError((e as AnyValue).fields ? null : (e as AnyValue).message)
    } finally {
      setBusy(null)
    }
  }
  const create = () =>
    run('create', async () => {
      setSecret(await apiPost('/member/agent/keys', { currentPassword: password }))
      reload()
    })
  const revoke = (id: number) =>
    run(`revoke-${id}`, async () => {
      await apiPost(`/member/agent/keys/${id}/revoke`, { currentPassword: password })
      if (secret?.id === id) setSecret(null)
      reload()
    })

  return (
    <div className="agentConnect">
      <Steps data={data} hasKey={activeKeys.length > 0} />

      {!data.eligible ? (
        <Empty
          icon={Lock}
          title="Not available for this account"
          body={GATE_COPY[data.gate] || GATE_COPY.no_mandate}
        />
      ) : (
        <>
          <div className="grid2">
            <Section label="This key can see">
              <div className="card cardTight agentScope">
                <span className="chip chip-accent">{ROLE_LABEL[data.connectorRole]}</span>
                {data.groups.length > 0 ? (
                  <div className="rowGap">
                    {data.groups.map((slug: string) => (
                      <span key={slug} className="chip chip-neutral">
                        {label(slug)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="metaMuted">No working-group tools on this mandate.</p>
                )}
              </div>
            </Section>
            <Section label="Tools the agent may call">
              <ul className="card cardTight agentTools">
                {data.tools.map((tool: string) => (
                  <li key={tool}>
                    <code>{tool}</code>
                    <span className="meta">{TOOL_COPY[tool]}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          {secret && (
            <section className="card agentSecret" role="status">
              <h2>Copy this key now</h2>
              <p className="meta">
                It is shown once. Paste it where the snippet says YOUR_KEY. Revoke it here if it
                leaks.
              </p>
              <div className="agentSecretValue">
                <code>{secret.key}</code>
                <Button
                  sm
                  variant="secondary"
                  onClick={() => navigator.clipboard?.writeText(secret.key)}
                >
                  <Copy size={15} aria-hidden />
                  Copy
                </Button>
              </div>
              <Button sm variant="ghost" onClick={() => setSecret(null)}>
                I have copied it
              </Button>
            </section>
          )}

          <Section label="Connect your agent">
            <div className="card agentSnippet">
              <div className="rowGap" role="tablist" aria-label="Agent">
                {(['claude', 'cursor'] as const).map((value) => (
                  <Button
                    key={value}
                    sm
                    role="tab"
                    aria-selected={snippet === value}
                    variant={snippet === value ? 'secondary' : 'ghost'}
                    onClick={() => setSnippet(value)}
                  >
                    {value === 'claude' ? 'Claude Code' : 'Cursor (.cursor/mcp.json)'}
                  </Button>
                ))}
              </div>
              <pre>
                <code>{SNIPPETS[snippet](url)}</code>
              </pre>
            </div>
          </Section>

          <Section label="Keys">
            {error && <ErrorCard message={error} />}
            {(data.keys || []).length === 0 ? (
              <Empty icon={Key} title="No keys yet" body="Create one below. It lasts 90 days." />
            ) : (
              <ul className="agentKeys">
                {data.keys.map((k: Doc) => (
                  <li key={k.id} className="card cardTight agentKey">
                    <div>
                      <code>{k.prefix}…</code>
                      <span className="metaMuted">
                        {k.state === 'active'
                          ? `Expires ${formatDateTime(k.expiresAt)}`
                          : k.state === 'expired'
                            ? 'Expired'
                            : 'Revoked'}
                        {k.lastUsedAt ? ` · last used ${formatDateTime(k.lastUsedAt)}` : ''}
                      </span>
                    </div>
                    {k.state === 'active' && (
                      <Button
                        sm
                        variant="ghost"
                        disabled={!password || busy !== null}
                        title={password ? undefined : 'Enter your password below first'}
                        onClick={() => revoke(k.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="card agentCreate">
              <label className="field">
                <span>Current password (to create or revoke a key)</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FieldError msg={fields.currentPassword} />
              </label>
              <div className="rowGap">
                <Button
                  variant="primary"
                  disabled={!password || busy !== null || activeKeys.length >= 3}
                  onClick={create}
                >
                  <Key size={16} aria-hidden />
                  {busy === 'create' ? 'Creating…' : 'Create key'}
                </Button>
                {activeKeys.length >= 3 && (
                  <span className="metaMuted">
                    Three active keys is the limit — revoke one first.
                  </span>
                )}
              </div>
            </div>
          </Section>
        </>
      )}
      <p className="metaMuted">
        Keys stop working when you change your password or lose the mandate. See{' '}
        <A href="/help" className="inlineLink">
          Help
        </A>{' '}
        for what the connector can and cannot do.
      </p>
    </div>
  )
}
