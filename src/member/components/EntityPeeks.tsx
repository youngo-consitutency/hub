'use client'

import { createElement, useState } from 'react'
import {
  TbCalendar,
  TbCalendarClock,
  TbCalendarPlus,
  TbChevronRight,
  TbExternalLink,
  TbFileDescription,
  TbFileText,
  TbGlobe,
  TbHeartHandshake,
  TbInfoCircle,
  TbLink,
  TbMapPin,
  TbPlayerPlay,
  TbShare,
  TbShieldCheck,
  TbSpeakerphone,
  TbTag,
  TbUsers,
  TbVideo,
} from 'react-icons/tb'
import { NotionSidePeek, NotionCallout } from './NotionSidePeek'
import { A, Button, LifecycleTiming, StatusChip } from './ui'
import { AddToCalendar } from './AddToCalendar'
import { DestinationIcon } from './DestinationLink'
import { fmtDual, fmtDateRange } from '../lib/time'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { regionLabel } from '../lib/regions'
import { resolveCoyStatus, coyApplicationsAreOpen } from '../../shared/coyStatus'
import type { AnyValue } from '../lib/types'

// ── Opportunity Peek ─────────────────────────────────────────

const OPPORTUNITY_KINDS: Record<string, string> = {
  event: 'Event',
  workshop: 'Workshop',
  hackathon: 'Hackathon',
  opportunity: 'Opportunity',
  call: 'Open call',
  training: 'Training',
}

const OPPORTUNITY_FORMATS: Record<string, string> = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Hybrid',
}

export function OpportunityPeek({ item, onClose }: { item: AnyValue | null; onClose: () => void }) {
  if (!item) return null

  const kindLabel = OPPORTUNITY_KINDS[item.kind] || item.kind || 'Opportunity'
  const formatLabel = OPPORTUNITY_FORMATS[item.format] || item.format || 'Online'
  const where =
    item.format === 'online' ? 'Online / Remote' : item.location || 'Location specified in portal'
  const region = item.region ? regionLabel(item.region) : 'Global / All regions'

  const properties = [
    {
      label: 'Type',
      icon: TbTag,
      value: <span className="chip chip-accent">{kindLabel}</span>,
    },
    {
      label: 'Format',
      icon: item.format === 'online' ? TbVideo : TbMapPin,
      value: <span>{formatLabel}</span>,
    },
    {
      label: 'Location',
      icon: TbMapPin,
      value: <span>{where}</span>,
    },
    {
      label: 'Region',
      icon: TbGlobe,
      value: <span>{region}</span>,
    },
    ...(item.organizationName
      ? [
          {
            label: 'Organisation',
            icon: TbHeartHandshake,
            value: <strong>{item.organizationName}</strong>,
          },
        ]
      : []),
    ...(item.deadlineAt
      ? [
          {
            label: 'Application deadline',
            icon: TbCalendarClock,
            value: <span className="mono">{fmtDual(item.deadlineAt)}</span>,
          },
        ]
      : []),
    ...(item.startsAt
      ? [
          {
            label: 'Commences',
            icon: TbCalendar,
            value: <span className="mono">{fmtDual(item.startsAt)}</span>,
          },
        ]
      : []),
  ]

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          {item.summary && (
            <NotionCallout icon={TbInfoCircle} tone="accent">
              <p>{item.summary}</p>
            </NotionCallout>
          )}

          <div className="notionSection">
            <h4 className="notionSectionHeading">Key particulars</h4>
            <ul className="notionBulletList">
              <li>
                <strong>Delivery mode:</strong> {formatLabel} ({where})
              </li>
              <li>
                <strong>Regional scope:</strong> {region}
              </li>
              {item.startsAt && (
                <li>
                  <strong>Commencement date:</strong> {fmtDual(item.startsAt)}
                </li>
              )}
              {item.deadlineAt && (
                <li>
                  <strong>Closing date:</strong> {fmtDual(item.deadlineAt)}
                </li>
              )}
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'apply',
      label: 'Application & timeline',
      icon: TbExternalLink,
      content: (
        <div className="notionTabContent">
          {item.deadlineAt && (
            <div className="notionCardGroup">
              <LifecycleTiming iso={item.deadlineAt} label="Apply by" showCountdown />
            </div>
          )}

          <div className="notionSection">
            <h4 className="notionSectionHeading">Submission portal</h4>
            <p className="notionBodyText">
              Applications are managed by {item.organizationName || 'the organising body'} through
              its own portal.
            </p>

            {item.linkUrl && (
              <div className="notionActionRow">
                <a
                  className="btn btn-primary btn-lg"
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TbExternalLink size={18} strokeWidth={1.75} aria-hidden />
                  <span>Open application portal</span>
                </a>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      label: 'Actions & share',
      icon: TbShare,
      content: (
        <div className="notionTabContent">
          <div className="notionSection">
            <h4 className="notionSectionHeading">Direct links & calendar</h4>
            <p className="notionBodyText">
              Share this call with your Working Group, Regional Caucus, or constituency network.
            </p>

            <div className="notionActionButtonsList">
              {item.deadlineAt && (
                <div className="notionCalendarActionWrap">
                  <AddToCalendar
                    event={{
                      title: `Deadline: ${item.title}`,
                      description: `${item.summary || ''}\n\nApply: ${item.linkUrl || ''}`,
                      startsAt: item.deadlineAt,
                      endsAt: item.deadlineAt,
                    }}
                  />
                </div>
              )}

              {item.linkUrl && (
                <a
                  className="btn btn-secondary"
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                  <span>Direct link</span>
                </a>
              )}
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <NotionSidePeek
      isOpen={Boolean(item)}
      onClose={onClose}
      eyebrow={`Opportunities › ${kindLabel}`}
      title={item.title}
      subtitle={item.organizationName}
      icon={TbSpeakerphone}
      badge={<span className="chip chip-accent">{kindLabel}</span>}
      properties={properties}
      tabs={tabs}
      actions={
        item.linkUrl ? (
          <a
            className="btn btn-primary btn-sm"
            href={item.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <TbExternalLink size={15} strokeWidth={1.75} aria-hidden />
            <span>Apply now</span>
          </a>
        ) : null
      }
      copyUrl={item.linkUrl}
    />
  )
}

// ── Event Peek ───────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  constituency_call: 'Constituency call',
  wg_call: 'Working Group call',
  wgf: 'Working Group Forum',
  unfccc_session: 'UNFCCC Session',
  webinar: 'Webinar',
  workshop: 'Workshop',
  coordination: 'Coordination meeting',
}

export function EventPeek({ event, onClose }: { event: AnyValue | null; onClose: () => void }) {
  const [now] = useState(() => Date.now())
  if (!event) return null
  const startMs = new Date(event.startsAt).getTime()
  const endMs = new Date(event.endsAt).getTime()
  const isLive = now >= startMs && now <= endMs
  const isConcluded = now > endMs
  const typeLabel = EVENT_TYPE_LABELS[event.type] || event.type || 'Event'

  const GroupIcon = event.wg?.slug ? workingGroupIcon(event.wg.slug) : TbUsers

  const properties = [
    {
      label: 'Type',
      icon: TbTag,
      value: <span className="chip chip-neutral">{typeLabel}</span>,
    },
    {
      label: 'Status',
      icon: TbCalendarClock,
      value: isLive ? (
        <StatusChip status="live_now" />
      ) : isConcluded ? (
        <span className="chip chip-neutral">Concluded</span>
      ) : (
        <span className="chip chip-accent">Upcoming</span>
      ),
    },
    {
      label: 'Date & time',
      icon: TbCalendar,
      value: <span className="mono">{fmtDual(event.startsAt)}</span>,
    },
    ...(event.wg
      ? [
          {
            label: 'Working Group',
            icon: GroupIcon,
            value: (
              <A href={`/groups/${event.wg.slug}`} className="inlineLink">
                {event.wg.name}
              </A>
            ),
          },
        ]
      : []),
    ...(event.meetingUrl && !isConcluded
      ? [
          {
            label: 'Meeting room',
            icon: TbVideo,
            value: (
              <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="inlineLink">
                Join link available
              </a>
            ),
          },
        ]
      : []),
  ]

  const descriptionUrl = event.description
    ?.match(/https?:\/\/\S+/)?.[0]
    ?.replace(/[),.;:!?'">\]]+$/, '')
  const cleanDescription = event.description
    ?.replace(/\s*(?:Slides:\s*)?https?:\/\/\S+/i, '')
    .trim()

  const tabs = [
    {
      id: 'overview',
      label: 'Overview & agenda',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          {isLive && (
            <NotionCallout icon={TbVideo} tone="accent">
              <strong>Meeting is live right now!</strong> Click the Join Meeting button below to
              participate in the session.
            </NotionCallout>
          )}

          {cleanDescription ? (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Meeting briefing</h4>
              <p className="notionBodyText">{cleanDescription}</p>
            </div>
          ) : (
            <p className="metaMuted">No formal agenda notes attached to this session.</p>
          )}

          {event.wg && (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Organised by</h4>
              <div className="notionInlineCard">
                {createElement(event.wg?.slug ? workingGroupIcon(event.wg.slug) : TbUsers, {
                  size: 20,
                  strokeWidth: 1.75,
                  'aria-hidden': true,
                })}
                <div>
                  <strong>{event.wg.name} Working Group</strong>
                </div>
                <A href={`/groups/${event.wg.slug}`} className="btn btn-ghost btn-sm" peek={false}>
                  View group
                </A>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'join',
      label: 'Join & calendar',
      icon: TbCalendarPlus,
      content: (
        <div className="notionTabContent">
          <div className="notionSection">
            <h4 className="notionSectionHeading">Live participation</h4>
            {isConcluded ? (
              <p className="metaMuted">
                This call has concluded. See the recording tab for past outputs.
              </p>
            ) : (
              <div className="notionActionRow">
                {event.meetingUrl && (
                  <a
                    className={`btn ${isLive ? 'btn-primary btn-glow' : 'btn-primary'}`}
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <TbVideo size={18} strokeWidth={1.75} aria-hidden />
                    <span>{isLive ? 'Join meeting — live now' : 'Join meeting'}</span>
                  </a>
                )}
                <AddToCalendar event={event} />
              </div>
            )}
          </div>

          {descriptionUrl && (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Session materials & slides</h4>
              <a
                className="btn btn-secondary"
                href={descriptionUrl}
                target="_blank"
                rel="noreferrer"
              >
                <DestinationIcon url={descriptionUrl} size={16} />
                <span>Open presentation / documentation</span>
              </a>
            </div>
          )}
        </div>
      ),
    },
    ...(isConcluded && event.recordingUrl
      ? [
          {
            id: 'recording',
            label: 'Recording & notes',
            icon: TbPlayerPlay,
            content: (
              <div className="notionTabContent">
                <div className="notionSection">
                  <h4 className="notionSectionHeading">Archived recording</h4>
                  <p className="notionBodyText">The recording is available for review.</p>
                  <div className="notionActionRow">
                    <a
                      className="btn btn-primary"
                      href={event.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <TbPlayerPlay size={18} strokeWidth={1.75} aria-hidden />
                      <span>Watch session recording</span>
                    </a>
                  </div>
                </div>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <NotionSidePeek
      isOpen={Boolean(event)}
      onClose={onClose}
      eyebrow={`Calendar › ${typeLabel}`}
      title={event.title}
      subtitle={event.wg ? `${event.wg.name} WG` : undefined}
      icon={TbCalendar}
      badge={
        isLive ? (
          <StatusChip status="live_now" />
        ) : (
          <span className="chip chip-neutral">{typeLabel}</span>
        )
      }
      fullPageHref={`/calendar/${event.slug}`}
      properties={properties}
      tabs={tabs}
      actions={
        !isConcluded && event.meetingUrl ? (
          <a
            className="btn btn-primary btn-sm"
            href={event.meetingUrl}
            target="_blank"
            rel="noreferrer"
          >
            <TbVideo size={15} strokeWidth={1.75} aria-hidden />
            <span>Join call</span>
          </a>
        ) : null
      }
    />
  )
}

// ── Working Group Peek ───────────────────────────────────────

export function GroupPeek({ group, onClose }: { group: AnyValue | null; onClose: () => void }) {
  if (!group) return null

  const IconComponent = workingGroupIcon(group.slug)

  const properties = [
    {
      label: 'Focus',
      icon: TbTag,
      value: <span>{group.focusLine || 'Constituency thematic track'}</span>,
    },
    ...(group.cadenceNote
      ? [
          {
            label: 'Meeting cadence',
            icon: TbCalendarClock,
            value: <span>{group.cadenceNote}</span>,
          },
        ]
      : []),
  ]

  const tabs = [
    {
      id: 'overview',
      label: 'Overview & mandate',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          {group.focusLine && (
            <NotionCallout icon={IconComponent} tone="accent">
              <p>{group.focusLine}</p>
            </NotionCallout>
          )}

          <div className="notionActionRow">
            <A href={`/groups/${group.slug}`} className="btn btn-primary" peek={false}>
              <span>Open full workspace</span>
              <TbChevronRight size={16} strokeWidth={2} aria-hidden />
            </A>
          </div>
        </div>
      ),
    },
  ]

  return (
    <NotionSidePeek
      isOpen={Boolean(group)}
      onClose={onClose}
      eyebrow="Working Groups"
      title={group.name}
      subtitle={group.focusLine}
      icon={IconComponent}
      badge={<span className="chip chip-accent">Active WG</span>}
      fullPageHref={`/groups/${group.slug}`}
      properties={properties}
      tabs={tabs}
      actions={
        <A href={`/groups/${group.slug}`} className="btn btn-primary btn-sm" peek={false}>
          <span>Open workspace</span>
        </A>
      }
    />
  )
}

// ── COY Peek ─────────────────────────────────────────────────

export function CoyPeek({ coy, onClose }: { coy: AnyValue | null; onClose: () => void }) {
  if (!coy) return null

  const place = [coy.city, coy.country].filter(Boolean).join(', ')
  const status = resolveCoyStatus(coy)
  const applicationsOpen = coyApplicationsAreOpen(coy)

  const properties = [
    {
      label: 'Type',
      icon: TbTag,
      value: <span className="chip chip-neutral">{coy.type?.toUpperCase() || 'COY'}</span>,
    },
    {
      label: 'Location',
      icon: TbMapPin,
      value: <span>{place || 'Location to be confirmed'}</span>,
    },
    {
      label: 'Dates',
      icon: TbCalendar,
      value: <span className="mono">{fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc)}</span>,
    },
    {
      label: 'Status',
      icon: TbShieldCheck,
      value: <StatusChip status={status} />,
    },
    ...(coy.region
      ? [
          {
            label: 'Region',
            icon: TbGlobe,
            value: <span>{regionLabel(coy.region)}</span>,
          },
        ]
      : []),
  ]

  const tabs = [
    {
      id: 'overview',
      label: 'Overview & venue',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          <NotionCallout icon={TbMapPin} tone="accent">
            <strong>{coy.type?.toUpperCase() || 'COY'}</strong>
            {place ? ` — ${place}` : ''}
          </NotionCallout>

          {coy.applicationsCloseAt && (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Application deadline</h4>
              <LifecycleTiming
                iso={coy.applicationsCloseAt}
                label="Applications close"
                showCountdown={applicationsOpen}
              />
            </div>
          )}

          {coy.registerUrl && (
            <div className="notionActionRow">
              <a
                className="btn btn-primary"
                href={coy.registerUrl}
                target="_blank"
                rel="noreferrer"
              >
                <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                <span>Official registration portal</span>
              </a>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <NotionSidePeek
      isOpen={Boolean(coy)}
      onClose={onClose}
      eyebrow={`COY Tracker › ${coy.type?.toUpperCase() || 'COY'}`}
      title={coy.title}
      subtitle={place}
      icon={TbMapPin}
      badge={<StatusChip status={status} />}
      fullPageHref={`/coys/${coy.slug}`}
      properties={properties}
      tabs={tabs}
    />
  )
}

// ── Submission Peek ──────────────────────────────────────────

export function SubmissionPeek({
  submission,
  onClose,
}: {
  submission: AnyValue | null
  onClose: () => void
}) {
  if (!submission) return null

  const properties = [
    {
      label: 'Status',
      icon: TbShieldCheck,
      value: <StatusChip status={submission.status} />,
    },
    ...(submission.wg
      ? [
          {
            label: 'Working Group',
            icon: TbUsers,
            value: (
              <A href={`/groups/${submission.wg.slug}`} className="inlineLink">
                {submission.wg.name} WG
              </A>
            ),
          },
        ]
      : []),
    ...(submission.deadlineAt
      ? [
          {
            label: 'Deadline',
            icon: TbCalendarClock,
            value: <span className="mono">{fmtDual(submission.deadlineAt)}</span>,
          },
        ]
      : []),
  ]

  const tabs = [
    {
      id: 'overview',
      label: 'Statement summary',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          {submission.description && (
            <NotionCallout icon={TbFileText} tone="default">
              <p>{submission.description}</p>
            </NotionCallout>
          )}

          {submission.contributeNote && (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Consultation guidance</h4>
              <p className="notionBodyText">{submission.contributeNote}</p>
            </div>
          )}

          <div className="notionActionRow">
            {submission.draftUrl && (
              <a
                className="btn btn-primary"
                href={submission.draftUrl}
                target="_blank"
                rel="noreferrer"
              >
                <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                <span>Open drafting document</span>
              </a>
            )}
            {submission.finalUrl && (
              <a
                className="btn btn-secondary"
                href={submission.finalUrl}
                target="_blank"
                rel="noreferrer"
              >
                <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                <span>View published statement</span>
              </a>
            )}
          </div>
        </div>
      ),
    },
  ]

  return (
    <NotionSidePeek
      isOpen={Boolean(submission)}
      onClose={onClose}
      eyebrow="Policy & Statements"
      title={submission.title}
      subtitle={submission.wg ? `${submission.wg.name} Working Group` : undefined}
      icon={TbFileText}
      badge={<StatusChip status={submission.status} />}
      fullPageHref={`/submissions/${submission.slug}`}
      properties={properties}
      tabs={tabs}
    />
  )
}

// ── Resource Peek ───────────────────────────────────────────

export function ResourcePeek({
  resource,
  onClose,
  onReport,
}: {
  resource: AnyValue | null
  onClose: () => void
  onReport?: (resource: AnyValue) => void
}) {
  if (!resource) return null

  const isVerified = resource.verification?.status === 'verified'
  const topics = resource.topics || (resource.topic ? [resource.topic] : [])

  const properties = [
    {
      label: 'Type',
      icon: TbTag,
      value: <span className="chip chip-accent">{resource.type || 'Resource'}</span>,
    },
    {
      label: 'Verification',
      icon: TbShieldCheck,
      value: isVerified ? (
        <span className="chip chip-accent">Verified by YOUNGO</span>
      ) : (
        <span className="chip chip-neutral">Community submitted</span>
      ),
    },
    ...(resource.publisher
      ? [
          {
            label: 'Publisher',
            icon: TbUsers,
            value: <strong>{resource.publisher}</strong>,
          },
        ]
      : []),
    ...(resource.language
      ? [
          {
            label: 'Language',
            icon: TbGlobe,
            value: <span>{resource.language}</span>,
          },
        ]
      : []),
    ...(resource.region
      ? [
          {
            label: 'Region',
            icon: TbMapPin,
            value: <span>{regionLabel(resource.region)}</span>,
          },
        ]
      : []),
    ...(resource.url
      ? [
          {
            label: 'Resource link',
            icon: TbLink,
            value: (
              <a href={resource.url} target="_blank" rel="noreferrer" className="inlineLink">
                Open material
              </a>
            ),
          },
        ]
      : []),
  ]

  const tabs = [
    {
      id: 'overview',
      label: 'Summary & scope',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          {resource.summary && (
            <NotionCallout icon={TbFileText} tone="default">
              <p>{resource.summary}</p>
            </NotionCallout>
          )}

          {topics.length > 0 && (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Thematic areas</h4>
              <div className="notionPeekBadgesRow">
                {topics.map((t: string) => (
                  <span key={t} className="chip chip-neutral">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="notionActionRow">
            {resource.url && (
              <a className="btn btn-primary" href={resource.url} target="_blank" rel="noreferrer">
                <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                <span>Open resource</span>
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'verification',
      label: 'Verification & feedback',
      icon: TbShieldCheck,
      content: (
        <div className="notionTabContent">
          <div className="notionSection">
            <h4 className="notionSectionHeading">Quality & safeguarding</h4>
            <p className="notionBodyText">
              {isVerified
                ? 'This resource has been reviewed and marked as verified.'
                : 'This resource has not been verified.'}
            </p>
            {resource.verification?.checkedAt && (
              <p className="metaMuted">
                Last checked on {new Date(resource.verification.checkedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {onReport && (
            <div className="notionActionRow">
              <Button
                variant="secondary"
                onClick={() => {
                  onClose()
                  onReport(resource)
                }}
              >
                Report an issue with this resource
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <NotionSidePeek
      isOpen={Boolean(resource)}
      onClose={onClose}
      eyebrow="Resource Hub"
      title={resource.title}
      subtitle={resource.publisher}
      icon={TbFileText}
      badge={
        isVerified ? (
          <span className="chip chip-accent">Verified</span>
        ) : (
          <span className="chip chip-neutral">Resource</span>
        )
      }
      properties={properties}
      tabs={tabs}
      copyUrl={resource.url}
    />
  )
}
