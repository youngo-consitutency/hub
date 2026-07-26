import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { Button, Section, Empty } from './ui.jsx'
import { SearchableSelect } from './FormControls.jsx'
import { Building2 } from 'lucide-react'

const STATUS_COPY = {
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

/**
 * Lets a member say which organisation they work with. The organisation
 * confirms, and decides whether the link also opens its portal.
 */
export function OrgAffiliation() {
  const [mine, setMine] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [choice, setChoice] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const load = () => {
    apiGet('/member/ngo/affiliations')
      .then((res) => setMine(res.items || []))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
    apiGet('/member/ngo/organisations')
      .then((res) => setOrgs(res.items || []))
      .catch(() => {
        /* the picker stays empty; the rest of the page still works */
      })
  }, [])

  const request = async () => {
    if (!choice) return
    setError(null)
    setDone(null)
    try {
      await apiPost('/member/ngo/affiliations', { orgAccountId: choice })
      setDone('Request sent. The organisation will confirm it.')
      setChoice('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  // Organisations already requested or joined should not be offered again.
  const taken = new Set((mine || []).map((m) => m.orgAccountId))
  const options = orgs
    .filter((o) => !taken.has(o.id))
    .map((o) => ({
      value: o.id,
      label: o.country ? `${o.name} — ${o.country}` : o.name,
    }))

  return (
    <Section label="Your organisation">
      <div className="stack">
        {(mine || []).map((seat) => {
          const copy = STATUS_COPY[seat.status] || {
            chip: 'chip-neutral',
            label: seat.status,
            note: '',
          }
          return (
            <div key={seat.id} className="card cardTight rowBetween">
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
          <Empty
            icon={Building2}
            title="Not linked to an organisation"
            body="If you take part through a youth organisation, ask them to confirm it here."
          />
        )}

        {options.length > 0 && (
          <div className="card stack">
            <h3>Ask an organisation to confirm you</h3>
            <p className="meta">
              Choose the organisation you work with. They decide whether to
              confirm, and whether it also gives you access to their portal.
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
    </Section>
  )
}
