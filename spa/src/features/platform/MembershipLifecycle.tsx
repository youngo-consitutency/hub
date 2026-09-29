import { SidePanel } from '../../components/SidePanel.tsx'
import { TbLock as LockIcon, TbUserCheck as MembershipIcon } from 'react-icons/tb'
import { useState, type FormEvent } from 'react'
import { Empty, ErrorCard, PageHeader, Skeletons } from '../../components/ui.jsx'
import { PageSectionNav } from '../../components/PageSectionNav.jsx'
import { type Overview } from '../../../shared/platform.ts'
import { post, usePlatform, values } from './api.ts'
import { Field, Text, Select } from './fields.tsx'
import { Feedback } from './Feedback.tsx'

export function MembershipLifecycle() {
  const [editorOpen, setEditorOpen] = useState(false)
  const { data, error, loading, reload } = usePlatform<Overview>('/overview')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    setFailure('')
    setMessage('')
    try {
      const input = values(form)
      await post(`/members/${input.accountId}/membership`, input)
      form.reset()
      setEditorOpen(false)
      setMessage('Membership change recorded.')
      reload()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="platform stack">
      <PageHeader
        icon={MembershipIcon}
        action={
          data?.canReviewMembership && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setFailure('')
                setEditorOpen(true)
              }}
            >
              Record onboarding or renewal
            </button>
          )
        }
        title="Onboarding & renewal"
        description="Confirm constituency onboarding and keep membership renewals current."
      >
        <PageSectionNav section="membership" />
      </PageHeader>
      {loading && !data && <Skeletons n={3} />}
      {error && <ErrorCard message={error} onRetry={reload} />}
      <Feedback error={editorOpen ? '' : failure} message={message} />
      {data &&
        (data.canReviewMembership ? (
          <section className="stack">
            <h2>Membership records</h2>
            <p className="meta">
              Record reviewed Constituency Work onboarding and renewal here. Application review and
              account status are in the Applications tab.
            </p>
            <div
              className="platformTable"
              role="region"
              aria-label="People and membership records"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Record</th>
                    <th scope="col">Membership</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.entityType}</td>
                      <td>{p.membershipTrack.replaceAll('_', ' ')}</td>
                      <td>{p.membershipStatus.replaceAll('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.canReviewMembership && editorOpen && (
              <SidePanel title="Record onboarding or renewal" onClose={() => setEditorOpen(false)}>
                <Feedback error={failure} message="" />
                <form className="platformForm" onSubmit={submit}>
                  <Select label="Person" name="accountId">
                    {data.people
                      .filter((p) => p.entityType === 'individual')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </Select>
                  <Select label="Action" name="action">
                    <option value="activate_cw">Confirm Constituency Work onboarding</option>
                    <option value="renew_cw">Record renewal</option>
                    <option value="expire_cw">
                      End Constituency Work; retain Network membership
                    </option>
                  </Select>
                  <Field label="Onboarding cohort (for activation)" name="cohort" />
                  <Field label="Next renewal due" name="renewalDueAt" type="datetime-local" />
                  <Text
                    label="Review evidence and reason"
                    name="reason"
                    required
                    maxLength={2000}
                  />
                  <button className="btn btn-primary" disabled={busy}>
                    Record membership change
                  </button>
                </form>
              </SidePanel>
            )}
          </section>
        ) : (
          <Empty
            icon={LockIcon}
            title="Membership Team only"
            body="Membership Team access is required."
          />
        ))}
    </div>
  )
}
