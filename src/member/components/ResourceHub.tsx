interface ResourceCardProps {
  resource?: AnyValue
  onReport?: AnyValue
  onCorrect?: AnyValue
  onReview?: AnyValue
  onPeek?: (r: AnyValue) => void
}

interface ResourceCatalogueProps {
  heading?: AnyValue
  onCorrect?: AnyValue
}

interface ResourcePathwayGroupProps {
  group?: AnyValue
  items?: AnyValue
  onReport?: AnyValue
  onCorrect?: AnyValue
  onPeek?: (r: AnyValue) => void
}

interface ResourceSubmissionPanelProps {
  initialResource?: AnyValue
  onCancel?: AnyValue
}

interface ResourceReportProps {
  resource?: AnyValue
  onClose?: AnyValue
  onSaved?: AnyValue
}

import type { AnyValue } from '../lib/types'
import { SidePanel } from './SidePanel.tsx'
import { ResourcePeek } from './EntityPeeks'
import { TbLayoutSidebarRightExpand } from 'react-icons/tb'
import { SiteFavicon } from './SiteFavicon'
import { regionLabel } from '../lib/regions'
import { useMemo, useState } from 'react'
import {
  TbArrowUpRight as ArrowUpRight,
  TbBook2 as BookOpen,
  TbBriefcase as Briefcase,
  TbChartDots as Research,
  TbCoin as Funding,
  TbDatabase as Database,
  TbFileDescription as Report,
  TbFilter as Filter,
  TbLanguage as Language,
  TbMap2 as Map,
  TbPlayerPlay as Video,
  TbSchool as School,
  TbSearch as Search,
  TbSend as Send,
  TbTool as Tool,
  TbWorld as World,
} from 'react-icons/tb'
import { optionLabel as resourceLabel, useContentOptions } from '../lib/documents'
import { apiPatch, apiPost, useApi } from '../lib/api'
import { useAccount } from '../lib/accountContext'
import { FieldError } from './FormControls'
import { Async, Button, Empty, ErrorCard, FilterChip, FilterPill, Section, StatusChip } from './ui'

const PATHWAY_ICONS = {
  career: Briefcase,
  research: Research,
  education: School,
  investment: Funding,
}

const TYPE_ICONS = {
  guide: BookOpen,
  report: Report,
  toolkit: Tool,
  dataset: Database,
  course: School,
  article: Report,
  video: Video,
  platform: World,
  opportunity: Briefcase,
}

const EMPTY_RESOURCE = (vocab: AnyValue) => ({
  title: '',
  url: '',
  summary: '',
  publisher: '',
  pathway: vocab.resourcePathways[0]?.value || '',
  type: vocab.resourceTypes[0]?.value || '',
  topic: vocab.resourceTopics[0] || '',
  topics: vocab.resourceTopics[0] ? [vocab.resourceTopics[0]] : [],
  region: vocab.resourceRegions[0]?.value || '',
  language: vocab.resourceLanguages[0] || '',
})

export function ResourceCard({ resource, onReport, onCorrect, onReview, onPeek }: ResourceCardProps) {
  const { resourceTypes: RESOURCE_TYPES } = useContentOptions()
  const TypeIcon = (TYPE_ICONS as AnyValue)[resource.type] || BookOpen
  return (
    <article className="card resourceHubCard linkedEntityCard">
      {onPeek && (
        <button
          type="button"
          className="entityCardLinkOverlay"
          aria-label={`Open ${resource.title} in side peek`}
          onClick={() => onPeek(resource)}
        />
      )}
      {onPeek && (
        <button
          type="button"
          className="cardPeekTrigger"
          onClick={(e) => {
            e.stopPropagation()
            onPeek(resource)
          }}
          aria-label={`Side peek for ${resource.title}`}
        >
          <TbLayoutSidebarRightExpand size={13} strokeWidth={1.8} aria-hidden />
          <span>Side peek</span>
        </button>
      )}
      <div className="resourceHubCardTop">
        <SiteFavicon url={resource.url} />
        <a
          className="resourceHubOpen"
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${resource.title} in a new tab`}
        >
          <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden />
        </a>
      </div>
      <div className="resourceHubCardCopy">
        <h3>{resource.title}</h3>
        {resource.publisher && <p className="metaMuted">{resource.publisher}</p>}
        <p className="meta">{resource.summary}</p>
      </div>
      <div className="chipRow resourceHubTags" aria-label="Resource metadata">
        <FilterChip icon={TypeIcon} tone="accent">
          {resourceLabel(RESOURCE_TYPES, resource.type)}
        </FilterChip>
        {(resource.topics || [resource.topic]).map((topic: AnyValue) => (
          <FilterChip key={topic} icon={Filter}>
            {topic}
          </FilterChip>
        ))}
        <FilterChip icon={Map}>{regionLabel(resource.region)}</FilterChip>
        <FilterChip icon={Language}>{resource.language}</FilterChip>
      </div>
      <div className="resourceCardFooter">
        <p className="metaMuted">
          {resource.verification?.status === 'verified'
            ? `Checked ${new Date(resource.verification.checkedAt).toLocaleDateString()}`
            : resource.verification?.status === 'needs_changes'
              ? 'Needs attention'
              : resource.verification?.status === 'retired'
                ? 'Retired'
                : 'Needs verification'}
          {resource.verification?.openIssues > 0 ? ' · Issue reported' : ''}
        </p>
        <div className="resourceCardActions">
          {onReport && (
            <Button sm variant="ghost" onClick={() => onReport(resource)}>
              Report issue
            </Button>
          )}
          {onCorrect && (
            <Button sm variant="ghost" onClick={() => onCorrect(resource)}>
              Suggest edit
            </Button>
          )}
          {onReview && (
            <Button sm variant="secondary" onClick={() => onReview(resource)}>
              Review resource
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

export function ResourceCatalogue({
  heading = 'Resource catalogue',
  onCorrect,
}: ResourceCatalogueProps) {
  const query = useApi('/resources')
  const {
    resourcePathways: RESOURCE_PATHWAYS,
    resourceTypes: RESOURCE_TYPES,
    resourceTopics: RESOURCE_TOPICS,
  } = useContentOptions()
  const { account } = useAccount()
  const [reported, setReported] = useState<AnyValue>(null)
  const [selectedResource, setSelectedResource] = useState<AnyValue | null>(null)
  const [notice, setNotice] = useState('')
  const [limit, setLimit] = useState(12)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [pathway, setPathway] = useState('all')
  const [groupBy, setGroupBy] = useState('pathway')
  const [type, setType] = useState('all')
  const [topic, setTopic] = useState('all')

  const items = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean)
    return (query.data?.items || []).filter((item: AnyValue) => {
      const haystack = [
        item.title,
        item.summary,
        item.publisher,
        ...(item.topics || [item.topic]),
        item.type,
        item.pathway,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (
        words.every((word) => haystack.includes(word)) &&
        (pathway === 'all' || item.pathway === pathway) &&
        (type === 'all' || item.type === type) &&
        (topic === 'all' || (item.topics || [item.topic]).includes(topic)) &&
        (!verifiedOnly ||
          (item.verification?.status === 'verified' && !item.verification.openIssues))
      )
    })
  }, [pathway, query.data?.items, search, topic, type, verifiedOnly])

  return (
    <>
      {reported && (
        <SidePanel title="Report a resource issue" onClose={() => setReported(null)}>
          <ResourceReport
            key={reported.slug}
            resource={reported}
            onClose={() => setReported(null)}
            onSaved={() => {
              setReported(null)
              setNotice('Issue reported. A Content Publisher can now review it.')
              query.retry()
            }}
          />
        </SidePanel>
      )}
      {notice && (
        <p role="status" className="noticeBanner">
          {notice}
        </p>
      )}
      <Section label={heading} meta={query.data ? `${items.length} listed` : null}>
        <div className="resourceHubControls">
          <div className="catalogSearchRow">
            <label className="searchInputWrap resourceHubSearch">
              <Search size={18} strokeWidth={1.75} aria-hidden />
              <span className="srOnly">Search resources</span>
              <input
                className="input"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setLimit(12)
                }}
                placeholder="Search resources"
              />
            </label>
            <label className="catalogSelect">
              Group by
              <select
                className="input"
                value={groupBy}
                onChange={(event) => {
                  setGroupBy(event.target.value)
                  setLimit(12)
                }}
              >
                <option value="pathway">Pathway</option>
                <option value="none">None — A–Z</option>
              </select>
            </label>
          </div>
          <details className="resourceMoreFilters">
            <summary>
              Filters
              {[pathway !== 'all', type !== 'all', topic !== 'all'].filter(Boolean).length > 0
                ? ` · ${[pathway !== 'all', type !== 'all', topic !== 'all'].filter(Boolean).length} active`
                : ''}
            </summary>
            <div className="resourceHubFilterRows">
              <fieldset className="filterLevel">
                <legend>Pathway</legend>
                <div className="pillRow" aria-label="Pathway">
                  <FilterPill
                    active={pathway === 'all'}
                    icon={World}
                    onClick={() => {
                      setPathway('all')
                      setLimit(12)
                    }}
                  >
                    All pathways
                  </FilterPill>
                  {RESOURCE_PATHWAYS.map((item: AnyValue) => (
                    <FilterPill
                      key={item.value}
                      active={pathway === item.value}
                      icon={(PATHWAY_ICONS as AnyValue)[item.value]}
                      onClick={() => {
                        setPathway(item.value)
                        setLimit(12)
                      }}
                    >
                      {item.label}
                    </FilterPill>
                  ))}
                </div>
              </fieldset>
              <div className="resourceHubSelects">
                <label>
                  <span>Type</span>
                  <select
                    className="input"
                    value={type}
                    onChange={(event) => {
                      setType(event.target.value)
                      setLimit(12)
                    }}
                  >
                    <option value="all">All types</option>
                    {RESOURCE_TYPES.map((item: AnyValue) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Topic</span>
                  <select
                    className="input"
                    value={topic}
                    onChange={(event) => {
                      setTopic(event.target.value)
                      setLimit(12)
                    }}
                  >
                    <option value="all">All topics</option>
                    {RESOURCE_TOPICS.map((item: AnyValue) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </details>
          <div className="resourceFilterFooter">
            <label className="resourceCheck">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => {
                  setVerifiedOnly(event.target.checked)
                  setLimit(12)
                }}
              />{' '}
              Only checked links without open issues
            </label>
            <Button
              sm
              variant="secondary"
              disabled={
                !search && pathway === 'all' && type === 'all' && topic === 'all' && !verifiedOnly
              }
              onClick={() => {
                setSearch('')
                setPathway('all')
                setType('all')
                setTopic('all')
                setVerifiedOnly(false)
                setLimit(12)
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
        <Async query={query} skeletons={4}>
          {() =>
            items.length ? (
              groupBy === 'pathway' && pathway === 'all' ? (
                <div className="catalogGroups">
                  {[...RESOURCE_PATHWAYS, { value: 'other', label: 'Other resources' }].map(
                    (group) => {
                      const matches = items.filter((item: AnyValue) =>
                        group.value === 'other'
                          ? !RESOURCE_PATHWAYS.some((path: AnyValue) => path.value === item.pathway)
                          : item.pathway === group.value,
                      )
                      return matches.length ? (
                        <ResourcePathwayGroup
                          key={`${group.value}:${search}:${type}:${topic}:${verifiedOnly}`}
                          group={group}
                          items={matches}
                          onReport={account?.isVerified ? setReported : null}
                          onCorrect={onCorrect}
                        />
                      ) : null
                    },
                  )}
                </div>
              ) : (
                <div className="resourceHubGrid cardGrid">
                  {items.slice(0, limit).map((resource: AnyValue) => (
                    <ResourceCard
                      key={resource.slug}
                      resource={resource}
                      onReport={account?.isVerified ? setReported : null}
                      onCorrect={onCorrect}
                      onPeek={(r: AnyValue) => setSelectedResource(r)}
                    />
                  ))}
                </div>
              )
            ) : (
              <Empty
                icon={BookOpen}
                title={
                  query.data?.items?.length
                    ? 'No matching resources'
                    : 'The reviewed collection starts here'
                }
                body={
                  query.data?.items?.length
                    ? 'Try clearing a filter or using fewer search terms.'
                    : 'Members can suggest a resource below. It appears here only after independent review and publication.'
                }
              />
            )
          }
        </Async>
        {(groupBy === 'none' || pathway !== 'all') && items.length > limit && (
          <div className="resourceLoadMore">
            <Button variant="secondary" onClick={() => setLimit((value) => value + 12)}>
              Show more resources ({items.length - limit} remaining)
            </Button>
          </div>
        )}
      </Section>
      <ResourcePeek
        resource={selectedResource}
        onClose={() => setSelectedResource(null)}
        onReport={setReported}
      />
    </>
  )
}

function ResourcePathwayGroup({ group, items, onReport, onCorrect, onPeek }: ResourcePathwayGroupProps) {
  const [visible, setVisible] = useState(3)
  return (
    <Section label={group.label} meta={`${items.length} resources`}>
      {group.description && <p className="catalogGroupDescription">{group.description}</p>}
      <div className="cardGrid resourceHubGrid">
        {items.slice(0, visible).map((resource: AnyValue) => (
          <ResourceCard
            key={resource.slug}
            resource={resource}
            onReport={onReport}
            onCorrect={onCorrect}
            onPeek={onPeek}
          />
        ))}
      </div>
      {items.length > visible && (
        <Button sm variant="secondary" onClick={() => setVisible((count) => count + 6)}>
          Show more in {group.label} ({items.length - visible} remaining)
        </Button>
      )}
    </Section>
  )
}

export function ResourceSubmissionPanel({
  initialResource,
  onCancel,
}: ResourceSubmissionPanelProps) {
  const submissions = useApi('/member/resources/submissions/mine')
  const vocab = useContentOptions()
  const {
    resourcePathways: RESOURCE_PATHWAYS,
    resourceTypes: RESOURCE_TYPES,
    resourceTopics: RESOURCE_TOPICS,
    resourceRegions: RESOURCE_REGIONS,
    resourceLanguages: RESOURCE_LANGUAGES,
  } = vocab
  const [payload, setPayload] = useState(
    initialResource ? { ...EMPTY_RESOURCE(vocab), ...initialResource } : EMPTY_RESOURCE(vocab),
  )
  const [editingId, setEditingId] = useState<AnyValue>(null)
  const [open, setOpen] = useState(Boolean(initialResource))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState<AnyValue>({})

  const set = (key: AnyValue, value: AnyValue) =>
    setPayload((current: AnyValue) => ({
      ...current,
      [key]: value,
      ...(key === 'topic'
        ? {
            topics: [
              value,
              ...current.topics.filter((t: AnyValue) => t !== current.topic && t !== value),
            ],
          }
        : {}),
    }))
  const reset = () => {
    setPayload(EMPTY_RESOURCE(vocab))
    setEditingId(null)
    setOpen(false)
    setFields({})
  }
  const edit = (item: AnyValue) => {
    setPayload({
      ...EMPTY_RESOURCE(vocab),
      ...item.payload,
      topics: item.payload.topics || [item.payload.topic],
    })
    setEditingId(item.id)
    setOpen(true)
    setMessage('')
    setError('')
  }
  const submit = async (event: AnyValue) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    setFields({})
    try {
      if (editingId) await apiPatch(`/member/resources/submissions/${editingId}`, payload)
      else if (initialResource)
        await apiPost(`/member/resources/${initialResource.slug}/corrections`, payload)
      else await apiPost('/member/resources/submissions', payload)
      setMessage('Resource sent to the Content Publisher review queue.')
      reset()
      submissions.retry()
      if (initialResource) onCancel?.()
    } catch (submissionError) {
      setError((submissionError as AnyValue).message)
      setFields((submissionError as AnyValue).fields || {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      label={initialResource ? `Suggest an edit: ${initialResource.title}` : 'Suggest a resource'}
      action={
        <Button sm variant={open ? 'ghost' : 'primary'} onClick={() => setOpen((value) => !value)}>
          {open ? 'Close form' : 'Add resource'}
        </Button>
      }
    >
      <p className="sectionIntro">
        Share a useful public resource. A Content Publisher checks the link, description, and tags
        before it becomes public.
      </p>
      {message && (
        <div className="noticeBanner">
          <span className="noticeDot" />
          <p>{message}</p>
        </div>
      )}
      {open && (
        <SidePanel
          title={
            initialResource
              ? 'Suggest a resource edit'
              : editingId
                ? 'Edit resource submission'
                : 'Add a resource'
          }
          onClose={() => {
            setOpen(false)
            onCancel?.()
          }}
        >
          {error && <ErrorCard message={error} />}
          <form className="card resourceSubmissionForm" onSubmit={submit}>
            <div className="formGrid">
              <label>
                Title
                <input
                  className="input"
                  required
                  value={payload.title}
                  onChange={(event) => set('title', event.target.value)}
                />
                <FieldError msg={fields.title} />
              </label>
              <label>
                Public link
                <input
                  className="input"
                  required
                  type="url"
                  value={payload.url}
                  onChange={(event) => set('url', event.target.value)}
                  placeholder="https://…"
                />
                <FieldError msg={fields.url} />
              </label>
            </div>
            <label>
              Why it is useful
              <textarea
                className="input textarea"
                required
                rows={4}
                value={payload.summary}
                onChange={(event) => set('summary', event.target.value)}
              />
              <FieldError msg={fields.summary} />
            </label>
            <div className="formGrid resourceFormTaxonomy">
              <label>
                Pathway
                <select
                  className="input"
                  value={payload.pathway}
                  onChange={(event) => set('pathway', event.target.value)}
                >
                  {RESOURCE_PATHWAYS.map((item: AnyValue) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <FieldError msg={fields.pathway} />
              </label>
              <label>
                Type
                <select
                  className="input"
                  value={payload.type}
                  onChange={(event) => set('type', event.target.value)}
                >
                  {RESOURCE_TYPES.map((item: AnyValue) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <FieldError msg={fields.type} />
              </label>
              <label>
                Topic
                <select
                  className="input"
                  value={payload.topic}
                  onChange={(event) => set('topic', event.target.value)}
                >
                  {RESOURCE_TOPICS.map((item: AnyValue) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <FieldError msg={fields.topic} />
              </label>
              <label>
                Region
                <select
                  className="input"
                  value={payload.region}
                  onChange={(event) => set('region', event.target.value)}
                >
                  {RESOURCE_REGIONS.map((item: AnyValue) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <FieldError msg={fields.region} />
              </label>
              <label>
                Language
                <select
                  className="input"
                  value={payload.language}
                  onChange={(event) => set('language', event.target.value)}
                >
                  {RESOURCE_LANGUAGES.map((item: AnyValue) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <FieldError msg={fields.language} />
              </label>
              <label>
                Publisher or author <span className="metaMuted">(optional)</span>
                <input
                  className="input"
                  value={payload.publisher}
                  onChange={(event) => set('publisher', event.target.value)}
                />
                <FieldError msg={fields.publisher} />
              </label>
            </div>
            <fieldset className="resourceTopicPicker">
              <legend>
                Additional topic tags{' '}
                <span className="metaMuted">(up to five including the main topic)</span>
              </legend>
              <div className="resourceTopicOptions">
                {RESOURCE_TOPICS.map((topic: AnyValue) => (
                  <label key={topic} className="resourceCheck">
                    <input
                      type="checkbox"
                      checked={payload.topics.includes(topic)}
                      disabled={
                        topic === payload.topic ||
                        (!payload.topics.includes(topic) && payload.topics.length >= 5)
                      }
                      onChange={(event) =>
                        set(
                          'topics',
                          event.target.checked
                            ? [...payload.topics, topic]
                            : payload.topics.filter((t: AnyValue) => t !== topic),
                        )
                      }
                    />
                    {topic}
                  </label>
                ))}
              </div>
              <FieldError msg={fields.topics} />
            </fieldset>
            <div className="resourceSubmissionActions">
              <Button type="submit" variant="primary" disabled={busy}>
                <Send size={16} strokeWidth={1.75} aria-hidden />
                {busy ? 'Sending…' : editingId ? 'Resubmit for review' : 'Send for review'}
              </Button>
              {(editingId || initialResource) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    reset()
                    onCancel?.()
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </SidePanel>
      )}

      <Async query={submissions} skeletons={2}>
        {(data: AnyValue) =>
          data.items.length ? (
            <div className="resourceSubmissionList">
              {data.items.map((item: AnyValue) => (
                <article key={item.id} className="card cardTight resourceSubmissionItem">
                  <div>
                    <strong>{item.payload.title}</strong>
                    <p className="meta">Submitted resource</p>
                    {item.reviewNote && (
                      <p className="contentReviewNote">Review note: {item.reviewNote}</p>
                    )}
                  </div>
                  <div className="resourceSubmissionStatus">
                    <StatusChip status={item.status} />
                    {item.status === 'changes_requested' && (
                      <Button sm variant="secondary" onClick={() => edit(item)}>
                        Edit and resubmit
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : null
        }
      </Async>
    </Section>
  )
}

function ResourceReport({ resource, onClose, onSaved }: ResourceReportProps) {
  const { resourceIssueKinds } = useContentOptions()
  const [kind, setKind] = useState('')
  const selectedKind = kind || resourceIssueKinds[0]?.value || ''
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: AnyValue) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiPost(`/member/resources/${resource.slug}/issues`, {
        kind: selectedKind,
        detail,
      })
      onSaved()
    } catch (error) {
      setError((error as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card resourceSubmissionForm" onSubmit={submit}>
      <h2>Report an issue: {resource.title}</h2>
      <p className="meta">Your report goes privately to Content Publishers for verification.</p>
      {error && <ErrorCard message={error} />}
      <label>
        Issue type
        <select
          className="input"
          value={selectedKind}
          onChange={(event) => setKind(event.target.value)}
        >
          {resourceIssueKinds.map((item: AnyValue) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        What needs attention?
        <textarea
          className="input textarea"
          required
          minLength={8}
          maxLength={2000}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={3}
        />
      </label>
      <div className="resourceCardActions">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send report'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
