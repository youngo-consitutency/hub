import type { AffiliationSeat, OrganisationOption } from '../../shared/contracts'
import { useState } from 'react'
import { apiPost, useApi, errorMessage } from '../lib/api'
import { Button } from './ui'
import { SearchableSelect } from './FormControls'
import { TbBuilding as Building2 } from 'react-icons/tb'

const STATUS_COPY: Record<string, { chip: string; label: string; note: string }> = {
  requested: {
    chip: 'chip-warn',
    label: 'Awaiting decision',
    note: 'Waiting for the organisation to confirm.',
  },
  active: {
    chip: 'chip-accent',
    label: 'Confirmed',
    note: 'The organisation confirmed this affiliation.',
  },
  declined: {
    chip: 'chip-neutral',
    label: 'Not confirmed',
    note: 'The organisation did not confirm this affiliation.',
  },
  invited: {
    chip: 'chip-info',
    label: 'Invitation pending',
    note: 'The organisation invited you — open the invitation to accept.',
  },
}

/** Lets a member name their organisation; the organisation confirms and decides on portal access. */
export function OrgAffiliation() {
  const affiliations = useApi<{ items: AffiliationSeat[] }>('/member/affiliations')
  const mine = affiliations.data ? affiliations.data.items || [] : null
  // a failed list leaves the picker empty; the rest still works
  const orgs = useApi<{ items: OrganisationOption[] }>('/member/organisations').data?.items || []
  const [choice, setChoice] = useState('')
  const [actionError, setError] = useState<string | null>(null)
  const error = actionError || affiliations.error
  const [done, setDone] = useState<string | null>(null)

  const request = async () => {
    if (!choice) return
    setError(null)
    setDone(null)
    try {
      await apiPost('/member/affiliations', { orgAccountId: choice })
      setDone('Request sent. The organisation will confirm it.')
      setChoice('')
      affiliations.retry()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Organisations already requested or joined should not be offered again.
  const taken = new Set((mine || []).map((m) => String(m.orgAccountId)))
  const options = orgs
    .filter((o) => !taken.has(String(o.id)))
    .map((o) => ({
      value: String(o.id),
      label: o.country ? `${o.name} — ${o.country}` : o.name,
    }))

  return (
    <section className="card organisationCard" aria-labelledby="organisation-title">
      <div className="organisationTitleRow">
        <span className="iconTile" aria-hidden>
          <Building2 size={20} strokeWidth={1.75} />
        </span>
        <div>
          <p className="pageEyebrow">Membership</p>
          <h2 id="organisation-title">Your organisation</h2>
        </div>
      </div>

      <div className="organisationBody">
        {(mine || []).map((seat) => {
          const copy = STATUS_COPY[seat.status] || {
            chip: 'chip-neutral',
            label: seat.status,
            note: '',
          }
          return (
            <div key={seat.id} className="organisationSeat rowBetween">
              <div>
                <strong>{seat.organizationName || 'Organisation'}</strong>
                <p className="meta">{copy.note}</p>
              </div>
              <span className={`chip ${copy.chip}`}>
                <span className="cdot" />
                {copy.label}
              </span>
            </div>
          )
        })}

        {mine && mine.length === 0 && (
          <div className="organisationEmpty">
            <strong>Not linked to an organisation</strong>
            <p className="meta">
              If you take part through a youth organisation, ask them to confirm it here.
            </p>
          </div>
        )}

        {options.length > 0 && (
          <div className="organisationRequest">
            <h3>Ask an organisation to confirm you</h3>
            <p className="meta">
              Choose the organisation you work with. They decide whether to confirm, and whether it
              also gives you access to their portal.
            </p>
            <SearchableSelect
              label="Organisation"
              options={options}
              value={choice}
              onChange={setChoice}
              searchPlaceholder="Search organisations…"
            />
            <div>
              <Button variant="primary" disabled={!choice} onClick={request}>
                Send request
              </Button>
            </div>
            {done && (
              <p className="meta" style={{ color: 'var(--accent)' }}>
                {done}
              </p>
            )}
            {error && <p className="fieldError">{error}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
