import { useEffect, useState } from 'react'
import {
  TbChevronLeft as ChevronLeft,
  TbChevronRight as ChevronRight,
  TbCopy as Copy,
  TbKey as KeyRound,
  TbMail as Mail,
  TbSearch as Search,
  TbSettings as Settings2,
  TbShieldCheck as ShieldCheck,
  TbX as X,
} from 'react-icons/tb'
import { apiGet, apiPatch, apiPost } from '../lib/api.js'
import {
  A,
  Button,
  Empty,
  ErrorCard,
  PageHeader,
  Section,
  Skeletons,
} from '../components/ui.jsx'
import { SearchableSelect } from '../components/FormControls.jsx'
import { FeedbackQueue } from '../components/FeedbackQueue.jsx'
import { OpportunityReview } from '../components/OpportunityReview.jsx'

const ENTITY_OPTIONS = [
  { value: '', label: 'All account types' },
  { value: 'individual', label: 'Individuals' },
  { value: 'organization', label: 'Organisations' },
]
const STATUS_OPTIONS = [
  { value: '', label: 'All lifecycle states' },
  { value: 'registered', label: 'Registered' },
  { value: 'course_passed', label: 'Course passed' },
  { value: 'awaiting_onboarding', label: 'Awaiting onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'renewal_due', label: 'Renewal due' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
]
const ROLE_OPTIONS = [
  { value: '', label: 'All platform roles' },
  { value: 'member', label: 'Member' },
  { value: 'focal_point', label: 'Focal Point' },
  { value: 'wg_contact', label: 'WG Contact Point' },
  { value: 'ngo_admin', label: 'NGO administrator' },
  { value: 'admin', label: 'Administrator' },
]
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'recent_login', label: 'Recently signed in' },
]
const TEAM_ROLES = [
  ['membership_team', 'Membership Team'],
  ['gys_policy_team', 'GYS Policy Team'],
  ['content_editor', 'Content editor'],
  ['content_publisher', 'Content publisher'],
]

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value
}

function AdminDialog({ title, children, onClose }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className="adminDialogBackdrop" onMouseDown={onClose}>
      <section
        className="adminDialog card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="adminDialogHeader">
          <h2>{title}</h2>
          <Button sm variant="ghost" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden />
          </Button>
        </div>
        {children}
      </section>
    </div>
  )
}

function AccountManager({ account, onClose, onChanged, onReset }) {
  const [status, setStatus] = useState(account.membershipStatus)
  const [role, setRole] = useState(account.role)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const reasonReady = reason.trim().length >= 8

  const run = async (key, request) => {
    setBusy(key)
    setError('')
    try {
      const result = await request()
      await onChanged()
      return result
    } catch (requestError) {
      setError(requestError.message)
      return null
    } finally {
      setBusy('')
    }
  }

  const updateStatus = () =>
    run('status', () =>
      apiPatch(`/member/admin/accounts/${account.id}/status`, {
        status,
        reason,
      }),
    )

  const updateRole = () =>
    run('role', () =>
      apiPost(`/member/admin/accounts/${account.id}/role`, { role, reason }),
    )

  const toggleTeamRole = (teamRole) => {
    const enabled = !account.teamRoles?.includes(teamRole)
    return run(teamRole, () =>
      apiPost(`/member/admin/accounts/${account.id}/team-role`, {
        teamRole,
        enabled,
        reason,
      }),
    )
  }

  const issueReset = async () => {
    const result = await run('reset', () =>
      apiPost(`/member/admin/accounts/${account.id}/reset-link`, { reason }),
    )
    if (result) {
      onClose()
      onReset(result)
    }
  }

  return (
    <AdminDialog title={`Manage ${account.name}`} onClose={onClose}>
      <p className="meta adminDialogIdentity">
        {account.email} · {account.entityType} · Hub {account.hubAccessStatus}
      </p>

      <label className="field">
        <span>Reason for this change</span>
        <textarea
          className="input textarea"
          rows="2"
          maxLength="500"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required for every admin action"
          autoFocus
        />
        <small className="metaMuted">
          At least 8 characters; kept in audit.
        </small>
      </label>

      {error && <ErrorCard message={error} />}

      <div className="adminActionBlock">
        <SearchableSelect
          label="Membership lifecycle"
          options={STATUS_OPTIONS.slice(1)}
          value={status}
          onChange={setStatus}
          searchPlaceholder="Search lifecycle states…"
        />
        <Button
          variant="secondary"
          disabled={!reasonReady || busy || status === account.membershipStatus}
          onClick={updateStatus}
        >
          <ShieldCheck size={16} aria-hidden />
          {busy === 'status' ? 'Updating…' : 'Confirm lifecycle change'}
        </Button>
      </div>

      <div className="adminActionBlock">
        <SearchableSelect
          label="Platform role"
          options={ROLE_OPTIONS.slice(1)}
          value={role}
          onChange={setRole}
          searchPlaceholder="Search platform roles…"
        />
        <Button
          variant="secondary"
          disabled={!reasonReady || busy || role === account.role}
          onClick={updateRole}
        >
          {busy === 'role' ? 'Updating…' : 'Confirm role change'}
        </Button>
      </div>

      <div className="adminActionBlock">
        <p className="fieldLabel">Team responsibilities</p>
        <div className="rowGap">
          {TEAM_ROLES.map(([teamRole, label]) => {
            const assigned = account.teamRoles?.includes(teamRole)
            return (
              <Button
                key={teamRole}
                sm
                variant={assigned ? 'secondary' : 'ghost'}
                disabled={!reasonReady || busy}
                onClick={() => toggleTeamRole(teamRole)}
              >
                {busy === teamRole
                  ? 'Updating…'
                  : `${assigned ? 'Remove' : 'Assign'} ${label}`}
              </Button>
            )
          })}
        </div>
        <p className="metaMuted">
          WG Contact Points are assigned inside the relevant WG workspace.
        </p>
      </div>

      <div className="adminDialogFooter">
        <Button
          variant="ghost"
          disabled={!reasonReady || busy}
          onClick={issueReset}
        >
          <KeyRound size={16} aria-hidden />
          {busy === 'reset' ? 'Issuing…' : 'Issue password reset'}
        </Button>
        {account.entityType === 'organization' && (
          <A href="/staff/points" className="btn btn-ghost">
            Award points
          </A>
        )}
      </div>
    </AdminDialog>
  )
}

function ResetHandoff({ reset, onClose }) {
  const [copied, setCopied] = useState(false)
  const subject = encodeURIComponent('Your YOUNGO Hub password reset')
  const body = encodeURIComponent(
    `Use this one-time link to reset your YOUNGO Hub password:\n\n${reset.resetUrl}\n\nIt expires ${new Date(reset.expiresAt).toLocaleString()}.`,
  )

  return (
    <AdminDialog title="Deliver password reset" onClose={onClose}>
      <p className="meta">
        This link is for <strong>{reset.email}</strong>. It expires{' '}
        {new Date(reset.expiresAt).toLocaleString()} and can be used once.
      </p>
      <code className="adminResetUrl">{reset.resetUrl}</code>
      <div className="adminDialogFooter">
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(reset.resetUrl)
            setCopied(true)
          }}
        >
          <Copy size={16} aria-hidden />
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <a
          className="btn btn-primary"
          href={`mailto:${encodeURIComponent(reset.email)}?subject=${subject}&body=${body}`}
        >
          <Mail size={16} aria-hidden />
          Open email draft
        </a>
      </div>
      <p className="metaMuted">
        The Hub does not send this automatically yet. Deliver it only to the
        account owner through a trusted channel, then dismiss this window.
      </p>
    </AdminDialog>
  )
}

export function Admin() {
  const [data, setData] = useState(null)
  const [audit, setAudit] = useState([])
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [nonce, setNonce] = useState(0)
  const [selected, setSelected] = useState(null)
  const [reset, setReset] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, entityType, status, role, sort])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({
      search,
      entityType,
      status,
      role,
      sort,
      page: String(page),
      pageSize: '12',
    })
    setError('')
    apiGet(`/member/admin/accounts?${params}`)
      .then((result) => active && setData(result))
      .catch((requestError) => active && setError(requestError.message))
    return () => {
      active = false
    }
  }, [search, entityType, status, role, sort, page, nonce])

  const loadAudit = async () => {
    try {
      const history = await apiGet('/member/admin/audit?limit=30')
      setAudit(history.items || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  useEffect(() => {
    loadAudit()
  }, [nonce])

  const reload = async () => {
    setNonce((value) => value + 1)
  }

  if (error && !data)
    return <ErrorCard message={error} onRetry={() => reload()} />
  if (!data) return <Skeletons n={5} />

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Find accounts, manage lifecycle and responsibilities, and review audited changes."
      />

      {error && <ErrorCard message={error} />}

      <div className="catalogTools adminTools">
        <label className="searchInputWrap">
          <Search size={18} aria-hidden />
          <span className="srOnly">Search accounts</span>
          <input
            className="input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email, organisation or country"
          />
        </label>
        <div className="adminFilters">
          <SearchableSelect
            label="Account type"
            options={ENTITY_OPTIONS}
            value={entityType}
            onChange={setEntityType}
            hideLabel
          />
          <SearchableSelect
            label="Lifecycle state"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            hideLabel
          />
          <SearchableSelect
            label="Platform role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={setRole}
            hideLabel
          />
          <SearchableSelect
            label="Sort accounts"
            options={SORT_OPTIONS}
            value={sort}
            onChange={setSort}
            hideLabel
          />
        </div>
      </div>

      <Section
        label="Accounts"
        action={
          <span>
            {data.total} result{data.total === 1 ? '' : 's'}
          </span>
        }
      >
        {data.items.length ? (
          <div className="cardGrid">
            {data.items.map((account) => (
              <article key={account.id} className="card cardTight adminAccount">
                <div>
                  <h3>{account.organizationName || account.name}</h3>
                  <p className="meta">{account.email}</p>
                </div>
                <div className="entityCardTags">
                  <span className="chip chip-neutral">
                    {labelFor(ENTITY_OPTIONS, account.entityType)}
                  </span>
                  <span className="chip chip-neutral">
                    {labelFor(STATUS_OPTIONS, account.membershipStatus)}
                  </span>
                  <span className="chip chip-neutral">
                    {labelFor(ROLE_OPTIONS, account.role)}
                  </span>
                </div>
                <p className="metaMuted">
                  {[account.country, account.region]
                    .filter(Boolean)
                    .join(' · ')}
                  {!account.country && !account.region && 'Location not set'}
                </p>
                <div className="adminAccountFooter">
                  <Button
                    sm
                    variant="secondary"
                    onClick={() => setSelected(account)}
                  >
                    <Settings2 size={16} aria-hidden />
                    Manage
                  </Button>
                  {account.teamRoles?.length > 0 && (
                    <span className="metaMuted">
                      {account.teamRoles.length} team role
                      {account.teamRoles.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={Search}
            title="No matching accounts"
            body="Change or clear a filter."
          />
        )}

        <nav className="pagination" aria-label="Account pages">
          <Button
            sm
            variant="ghost"
            disabled={data.page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft size={16} aria-hidden />
            Previous
          </Button>
          <span className="meta">
            Page {data.page} of {data.pages}
          </span>
          <Button
            sm
            variant="ghost"
            disabled={data.page >= data.pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
            <ChevronRight size={16} aria-hidden />
          </Button>
        </nav>
      </Section>

      <FeedbackQueue />

      <OpportunityReview />

      <Section label="Governance audit" action={<span>Latest 30</span>}>
        <div className="stackSm">
          {audit.map((entry) => (
            <div
              key={entry.id || `${entry.createdAt}-${entry.action}`}
              className="card cardTight auditRow"
            >
              <div>
                <strong>{entry.action}</strong>
                <p className="meta">
                  {entry.target_type || entry.targetType}:{' '}
                  {entry.target_id || entry.targetId || '—'} ·{' '}
                  {entry.actor_email || entry.actorId || 'system'}
                </p>
              </div>
              <time className="metaMuted">
                {new Date(entry.created_at || entry.createdAt).toLocaleString()}
              </time>
            </div>
          ))}
          {!audit.length && (
            <p className="metaMuted">No audited governance changes yet.</p>
          )}
        </div>
      </Section>

      {selected && (
        <AccountManager
          account={selected}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await reload()
            setSelected(null)
          }}
          onReset={setReset}
        />
      )}
      {reset && <ResetHandoff reset={reset} onClose={() => setReset(null)} />}
    </div>
  )
}
