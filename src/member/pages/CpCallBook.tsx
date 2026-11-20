import type { CpCallSlotsResponse, CpCallSlotView } from '../../shared/contracts'
import { useState } from 'react'
import { useApi, errorMessage } from '../lib/api'
import { apiPost } from '../lib/api'
import { Async, Button, Empty, ErrorCard, PageHeader, Section } from '../components/ui'
import { SearchableSelect } from '../components/FormControls'
import { fmtDate, fmtDual } from '../lib/time'
import { useWorkingGroups } from '../lib/workingGroups'
import { useAccount } from '../lib/accountContext'
import { TbCalendarCheck as CalendarCheck } from 'react-icons/tb'

function groupByDay(slots: CpCallSlotView[]) {
  const map = new Map<string, CpCallSlotView[]>()
  for (const slot of slots) {
    const day = fmtDate(slot.startsAt, 'UTC')
    map.set(day, [...(map.get(day) ?? []), slot])
  }
  return [...map.entries()]
}

export function CpCallBook() {
  const { account } = useAccount()
  const wg = useWorkingGroups()
  const WG_OPTIONS = wg.groups.map((group) => ({
    value: group.slug,
    label: group.name,
  }))
  const query = useApi<CpCallSlotsResponse>('/member/cp-calls/slots')
  const [wgSlug, setWgSlug] = useState(
    account?.access?.wgAssignments?.[0]?.wgSlug || account?.wgInterests?.[0] || '',
  )
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const book = async (id: number) => {
    setBusy(String(id))
    setError('')
    try {
      await apiPost(`/member/cp-calls/slots/${id}/book`, { wgSlug })
      query.retry()
    } catch (err) {
      setError(errorMessage(err))
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
      setError(errorMessage(err))
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
        {(data) => {
          // the server sends `mine` as a list holding at most the caller's own booking
          const mine = data.mine[0]
          return mine ? (
            <Section label="Your call">
              <div className="card cardTight">
                <p>
                  <CalendarCheck size={18} strokeWidth={1.75} aria-hidden />{' '}
                  {fmtDual(mine.startsAt)} with {mine.host?.name ?? 'your host'}
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
                        {slots.map((slot) => (
                          <div key={slot.id} className="card cardTight">
                            <strong>{slot.host?.name ?? 'Host'}</strong>
                            <p className="meta">{fmtDual(slot.startsAt)}</p>
                            <Button
                              variant="primary"
                              sm
                              disabled={Boolean(busy)}
                              onClick={() => book(slot.id)}
                            >
                              {busy === String(slot.id) ? 'Booking…' : 'Book'}
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
        }}
      </Async>
    </div>
  )
}
