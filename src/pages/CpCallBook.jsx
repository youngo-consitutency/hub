import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { apiPost } from '../lib/api.js'
import {
  Async,
  Button,
  Empty,
  ErrorCard,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { SearchableSelect } from '../components/FormControls.jsx'
import { fmtDual } from '../lib/time.js'
import { WORKING_GROUPS } from '../../shared/workingGroups.js'
import { useAccount } from '../lib/accountContext.jsx'
import { TbCalendarCheck as CalendarCheck } from 'react-icons/tb'

const WG_OPTIONS = WORKING_GROUPS.map((group) => ({
  value: group.slug,
  label: group.name,
}))

function groupByDay(slots) {
  const map = new Map()
  for (const slot of slots) {
    const day = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(slot.startsAt))
    if (!map.has(day)) map.set(day, [])
    map.get(day).push(slot)
  }
  return [...map.entries()]
}

export function CpCallBook() {
  const { account } = useAccount()
  const query = useApi('/member/cp-calls/slots')
  const [wgSlug, setWgSlug] = useState(
    account?.access?.wgAssignments?.[0]?.wgSlug ||
      account?.wgInterests?.[0] ||
      '',
  )
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const book = async (id) => {
    setBusy(id)
    setError('')
    try {
      await apiPost(`/member/cp-calls/slots/${id}/book`, { wgSlug })
      query.retry()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const cancel = async () => {
    setBusy('cancel')
    setError('')
    try {
      await apiPost('/member/cp-calls/mine/cancel', {})
      query.retry()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div>
      <PageHeader
        title="Book a WG section call"
        description="45 minutes with Genn or Jalo to set your working-group page and onboarding. Pick a slot — no need to negotiate times in WhatsApp."
      />
      {error && <ErrorCard message={error} onRetry={() => setError('')} />}
      <Async query={query}>
        {(data) =>
          data.mine ? (
            <Section label="Your call">
              <div className="card cardTight">
                <p>
                  <CalendarCheck size={18} strokeWidth={1.75} aria-hidden />{' '}
                  {fmtDual(data.mine.startsAt)} with {data.mine.hostLabel}
                </p>
                <p className="meta">
                  We’ll send the Meet link closer to the time. Change the slot
                  if you need to.
                </p>
                <Button
                  variant="secondary"
                  onClick={cancel}
                  disabled={busy === 'cancel'}
                >
                  {busy === 'cancel' ? 'Releasing…' : 'Pick a different time'}
                </Button>
              </div>
            </Section>
          ) : (
            <>
              <Section label="Your working group">
                <SearchableSelect
                  label="Working group"
                  options={WG_OPTIONS}
                  value={wgSlug}
                  onChange={setWgSlug}
                />
              </Section>
              <Section label="Open times">
                {data.slots.length ? (
                  groupByDay(data.slots).map(([day, slots]) => (
                    <div key={day} className="stackSm" style={{ marginBottom: 16 }}>
                      <h3>{day}</h3>
                      <div className="dashboardCardGrid">
                        {slots.map((slot) => (
                          <div key={slot.id} className="card cardTight">
                            <strong>{slot.hostLabel}</strong>
                            <p className="meta">{fmtDual(slot.startsAt)}</p>
                            <Button
                              variant="primary"
                              sm
                              disabled={Boolean(busy)}
                              onClick={() => book(slot.id)}
                            >
                              {busy === slot.id ? 'Booking…' : 'Book'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No open times yet"
                    body="Genn and Jalo are adding slots. Check back here rather than messaging the group."
                  />
                )}
              </Section>
            </>
          )
        }
      </Async>
    </div>
  )
}
