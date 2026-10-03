import { useState } from 'react'
import { useApi } from '../lib/api'
import { apiPost } from '../lib/api'
import { Async, Button, Empty, ErrorCard, PageHeader, Section } from '../components/ui'
import { SearchableSelect } from '../components/FormControls'
import { fmtDual } from '../lib/time'
import { useWorkingGroups } from '../lib/workingGroups'
import { useAccount } from '../lib/accountContext'
import { TbCalendarCheck as CalendarCheck } from 'react-icons/tb'

function groupByDay(slots: any) {
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
  const wg = useWorkingGroups()
  const WG_OPTIONS = wg.groups.map((group: any) => ({
    value: group.slug,
    label: group.name,
  }))
  const query = useApi('/member/cp-calls/slots')
  const [wgSlug, setWgSlug] = useState(
    account?.access?.wgAssignments?.[0]?.wgSlug || account?.wgInterests?.[0] || '',
  )
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const book = async (id: any) => {
    setBusy(id)
    setError('')
    try {
      await apiPost(`/member/cp-calls/slots/${id}/book`, { wgSlug })
      query.retry()
    } catch (err) {
      setError((err as any).message)
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
      setError((err as any).message)
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
        {(data: any) =>
          data.mine ? (
            <Section label="Your call">
              <div className="card cardTight">
                <p>
                  <CalendarCheck size={18} strokeWidth={1.75} aria-hidden />{' '}
                  {fmtDual(data.mine.startsAt)} with {data.mine.hostLabel}
                </p>
                <p className="meta">
                  We’ll send the Meet link closer to the time. Change the slot if you need to.
                </p>
                <Button variant="secondary" onClick={cancel} disabled={busy === 'cancel'}>
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
                        {slots.map((slot: any) => (
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
