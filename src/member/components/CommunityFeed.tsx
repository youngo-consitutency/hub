'use client'

import { useState } from 'react'

import type { OpportunitySummary, ResourceSummary } from '../../shared/contracts'
import {
  TbAlarm as AlarmIcon,
  TbArrowUpRight as ArrowUpRight,
  TbBooks as BookIcon,
  TbCompass as CompassIcon,
} from 'react-icons/tb'
import { useApi } from '../lib/api'
import { fmtStamp } from '../lib/time'
import { A, Section } from './ui'
import { Arrow, TbChevronRight as ChevronRight } from './dirIcons'

type Post = {
  key: string
  kind: 'Opportunity' | 'Resource'
  title: string
  note: string | null
  from: string
  href: string
  external: boolean
  when: string | null
}

const SHOWN = 4

function fromOpportunity(o: OpportunitySummary): Post {
  return {
    key: `o-${o.id}`,
    kind: 'Opportunity',
    title: o.title,
    note: o.summary,
    from: o.organizationName,
    href: `/opportunities/${o.id}`,
    external: false,
    when: o.deadlineAt,
  }
}

function fromResource(r: ResourceSummary): Post {
  return {
    key: `r-${r.slug}`,
    kind: 'Resource',
    title: r.title,
    note: r.summary,
    from: r.publisher || 'Shared with the community',
    href: r.url,
    external: true,
    when: null,
  }
}

/** What members and partners have shared lately; real records only, nothing when there are none. */
export function CommunityFeed() {
  const opps = useApi<{ items: OpportunitySummary[] }>('/member/opportunities?kind=all&format=all')
  const res = useApi<{ items: ResourceSummary[] }>('/resources')

  const [now] = useState(() => Date.now())
  const open = (opps.data?.items ?? [])
    .filter((o) => !o.deadlineAt || Date.parse(o.deadlineAt) > now)
    .slice(0, 2)
    .map(fromOpportunity)
  const shared = (res.data?.items ?? [])
    .filter((r) => r.summary)
    .slice(0, SHOWN - open.length)
    .map(fromResource)
  const posts = [...open, ...shared].slice(0, SHOWN)
  if (!posts.length) return null
  // a label that every row shares says nothing, so it only shows when kinds are mixed
  const mixed = new Set(posts.map((p) => p.kind)).size > 1

  return (
    <Section
      label="Shared with the community"
      action={
        <A href="/resources" className="metaMuted">
          Browse everything <Arrow />
        </A>
      }
    >
      <ul className="communityFeed">
        {posts.map((p) => {
          const Icon = p.kind === 'Resource' ? BookIcon : CompassIcon
          const body = (
            <>
              <span className="communityFeedIcon" aria-hidden>
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="communityFeedCopy">
                <span className="communityFeedFrom">
                  {mixed && <span className="chip chip-neutral communityFeedKind">{p.kind}</span>}
                  from {p.from}
                </span>
                <strong className="communityFeedTitle">{p.title}</strong>
                {p.note && <span className="meta communityFeedNote">{p.note}</span>}
                {p.when && (
                  <span className="communityFeedDue">
                    <AlarmIcon size={14} strokeWidth={1.75} aria-hidden />
                    Closes {fmtStamp(p.when)}
                  </span>
                )}
              </span>
              {p.external ? (
                <ArrowUpRight
                  className="communityFeedGo"
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : (
                <ChevronRight
                  className="communityFeedGo"
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
            </>
          )
          return (
            <li key={p.key}>
              {p.external ? (
                <a
                  className="card cardTight communityFeedItem"
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {body}
                </a>
              ) : (
                <A className="card cardTight communityFeedItem" href={p.href}>
                  {body}
                </A>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
