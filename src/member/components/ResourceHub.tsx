interface ResourceCardProps {
  resource?: AnyValue
  onReport?: AnyValue
  onCorrect?: AnyValue
  onReview?: AnyValue
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
import { SiteFavicon } from './SiteFavicon'
import { regionLabel } from '../lib/regions'
import { useMemo, useState } from 'react'
import {
  TbSortAscendingLetters as ArrowDownAZ,
  TbArrowUpRight as ArrowUpRight,
  TbBook2 as BookOpen,
  TbBriefcase as Briefcase,
  TbCircleCheck as Check,
  TbChartDots as Research,
  TbCoin as Funding,
  TbDatabase as Database,
  TbFileDescription as Report,
  TbFilter as Filter,
  TbLanguage as Language,
  TbMap2 as Map,
  TbPlayerPlay as Video,
  TbSchool as School,
  TbSend as Send,
  TbTool as Tool,
  TbWorld as World,
} from 'react-icons/tb'
import { optionLabel as resourceLabel, useContentOptions } from '../lib/documents'
import { apiPatch, apiPost, useApi } from '../lib/api'
import { useAccount } from '../lib/accountContext'
import { FieldError } from './FormControls'
import {
  Async,
  Button,
  Empty,
  ErrorCard,
  FilterChip,
  FilterMenu,
  FilterPill,
  CatalogToolbar,
  Section,
  SortButton,
  StatusChip,
} from './ui'

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

export function ResourceCard({ resource, onReport, onCorrect, onReview }: ResourceCardProps) {
  const { resourceTypes: RESOURCE_TYPES } = useContentOptions()
  const TypeIcon = (TYPE_ICONS as AnyValue)[resource.type] || BookOpen
  return (
    <article className="card resourceHubCard linkedEntityCard">
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

// one scannable line per resource: the whole row opens the link in a new tab, and only
// links a Content Publisher has checked (and nobody has reported) get the verified look
// a check older than a year no longer counts: links rot
const PAGE = 12
const CHECK_VALID_MS = 365 * 24 * 60 * 60 * 1000
const isChecked = (item: AnyValue) =>
  item.verification?.status === 'verified' &&
  !item.verification.openIssues &&
  Date.now() - new Date(item.verification.checkedAt).getTime() < CHECK_VALID_MS

function ResourceRow({ resource, onReport, onCorrect }: ResourceCardProps) {
  const { resourceTypes: RESOURCE_TYPES } = useContentOptions()
  const TypeIcon = (TYPE_ICONS as AnyValue)[resource.type] || BookOpen
  const v = resource.verification
  const checked = isChecked(resource)
  const status = checked
    ? `Checked ${new Date(v.checkedAt).toLocaleDateString()}`
    : v?.status === 'needs_changes' || v?.openIssues > 0
      ? 'Under review'
      : v?.status === 'retired'
        ? 'Retired'
        : v?.status === 'verified' && !v.openIssues
          ? 'Check due'
          : 'Not yet checked'
  const topics = (resource.topics || [resource.topic]).filter(Boolean)
  return (
    <li className="resourceRow resourceListRow" data-checked={checked || undefined}>
      <SiteFavicon url={resource.url} />
      <div className="resourceListCopy">
        <a href={resource.url} target="_blank" rel="noreferrer" className="resourceListLink">
          {resource.title}
          <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
          <span className="srOnly"> (opens in a new tab)</span>
        </a>
        {resource.publisher && <p className="metaMuted">{resource.publisher}</p>}
        {resource.summary && <p className="meta resourceListSummary">{resource.summary}</p>}
        <div className="chipRow">
          <FilterChip icon={TypeIcon} tone="accent">
            {resourceLabel(RESOURCE_TYPES, resource.type)}
          </FilterChip>
          {topics.slice(0, 3).map((topic: AnyValue) => (
            <FilterChip key={topic}>{topic}</FilterChip>
          ))}
          <FilterChip icon={Map}>{regionLabel(resource.region)}</FilterChip>
        </div>
      </div>
      <div className="resourceListSide">
        <span className="resourceListStatus">
          {checked && <Check size={14} strokeWidth={2.25} aria-hidden />}
          {status}
        </span>
        {(onReport || onCorrect) && (
          <span className="resourceCardActions">
            {onReport && (
              <Button sm variant="ghost" onClick={() => onReport(resource)}>
                Report
              </Button>
            )}
            {onCorrect && (
              <Button sm variant="ghost" onClick={() => onCorrect(resource)}>
                Suggest edit
              </Button>
            )}
          </span>
        )}
      </div>
    </li>
  )
}

// one section per category; every resource's type is in `options`, so none is left out
const sections = (options: AnyValue[]) =>
  options.map((o) => ({ ...o, has: (item: AnyValue) => item.type === o.value }))

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
  const [notice, setNotice] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [pathway, setPathway] = useState('all')
  const [groupBy, setGroupBy] = useState('type')
  const [type, setType] = useState('all')
  const [topic, setTopic] = useState('all')

  // every filter change starts again from the first page
  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setLimit(PAGE)
    }

  // everything but the category, so the category chips can show what each would give
  const pool = useMemo(() => {
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
        (topic === 'all' || (item.topics || [item.topic]).includes(topic)) &&
        (!verifiedOnly || isChecked(item))
      )
    })
  }, [pathway, query.data?.items, search, topic, verifiedOnly])
  // the vocabulary first, then any type that is in use but not listed there
  const typeOptions = useMemo(() => {
    const listed = new Set(RESOURCE_TYPES.map((o: AnyValue) => o.value))
    const extra = [...new Set<string>((query.data?.items || []).map((r: AnyValue) => r.type))]
      .filter((value) => value && !listed.has(value))
      .map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))
    return [...RESOURCE_TYPES, ...extra]
  }, [RESOURCE_TYPES, query.data?.items])
  const items = useMemo(
    () => pool.filter((item: AnyValue) => type === 'all' || item.type === type),
    [pool, type],
  )

  // sections for the chosen grouping; a resource with an unknown value lands in the last one
  const groups = groupBy === 'type' && type === 'all' ? sections(typeOptions) : null

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
        <CatalogToolbar
          search={{ label: 'Search resources', value: search, onChange: reset(setSearch) }}
          sortLabel="Group resources"
          sort={
            <>
              <SortButton
                active={groupBy === 'type'}
                icon={Filter}
                onClick={() => reset(setGroupBy)('type')}
              >
                By category
              </SortButton>
              <SortButton
                active={groupBy === 'none'}
                icon={ArrowDownAZ}
                onClick={() => reset(setGroupBy)('none')}
              >
                A–Z
              </SortButton>
            </>
          }
          filters={
            <>
              <FilterMenu
                activeCount={
                  [pathway !== 'all', topic !== 'all', verifiedOnly].filter(Boolean).length
                }
                onClear={() => {
                  setPathway('all')
                  setTopic('all')
                  setVerifiedOnly(false)
                  setLimit(PAGE)
                }}
              >
                {RESOURCE_PATHWAYS.length > 0 && (
                  <fieldset className="filterLevel">
                    <legend>Pathway</legend>
                    <div className="pillRow">
                      <FilterPill
                        active={pathway === 'all'}
                        icon={World}
                        onClick={() => reset(setPathway)('all')}
                      >
                        All pathways
                      </FilterPill>
                      {RESOURCE_PATHWAYS.map((item: AnyValue) => (
                        <FilterPill
                          key={item.value}
                          active={pathway === item.value}
                          icon={(PATHWAY_ICONS as AnyValue)[item.value]}
                          onClick={() => reset(setPathway)(item.value)}
                        >
                          {item.label}
                        </FilterPill>
                      ))}
                    </div>
                  </fieldset>
                )}
                <fieldset className="filterLevel">
                  <legend>Topic</legend>
                  <div className="pillRow">
                    <FilterPill
                      active={topic === 'all'}
                      icon={Filter}
                      onClick={() => reset(setTopic)('all')}
                    >
                      All topics
                    </FilterPill>
                    {RESOURCE_TOPICS.map((item: string) => (
                      <FilterPill
                        key={item}
                        active={topic === item}
                        onClick={() => reset(setTopic)(item)}
                      >
                        {item}
                      </FilterPill>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="filterLevel">
                  <legend>Checks</legend>
                  <div className="pillRow">
                    <FilterPill
                      active={verifiedOnly}
                      icon={Check}
                      onClick={() => reset(setVerifiedOnly)(!verifiedOnly)}
                    >
                      Only checked links without open issues
                    </FilterPill>
                  </div>
                </fieldset>
              </FilterMenu>
            </>
          }
        >
          <div className="pillRow" role="group" aria-label="Category">
            <FilterPill active={type === 'all'} icon={World} onClick={() => reset(setType)('all')}>
              All {pool.length}
            </FilterPill>
            {typeOptions.map((item: AnyValue) => {
              const n = pool.filter((r: AnyValue) => r.type === item.value).length
              return n ? (
                <FilterPill
                  key={item.value}
                  active={type === item.value}
                  icon={(TYPE_ICONS as AnyValue)[item.value]}
                  onClick={() => reset(setType)(item.value)}
                >
                  {item.label} {n}
                </FilterPill>
              ) : null
            })}
          </div>
        </CatalogToolbar>
        <Async query={query} skeletons={4}>
          {() =>
            items.length ? (
              groups ? (
                <div className="catalogGroups">
                  {groups.map((group: AnyValue) => {
                    const matches = items.filter((item: AnyValue) => group.has(item))
                    return matches.length ? (
                      <ResourcePathwayGroup
                        key={`${group.value}:${search}:${type}:${topic}:${verifiedOnly}`}
                        group={group}
                        items={matches}
                        onReport={account?.isVerified ? setReported : null}
                        onCorrect={onCorrect}
                      />
                    ) : null
                  })}
                </div>
              ) : (
                <ul className="resourceList">
                  {items.slice(0, limit).map((resource: AnyValue) => (
                    <ResourceRow
                      key={resource.slug}
                      resource={resource}
                      onReport={account?.isVerified ? setReported : null}
                      onCorrect={onCorrect}
                    />
                  ))}
                </ul>
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
        {!groups && items.length > limit && (
          <div className="resourceLoadMore">
            <Button variant="secondary" onClick={() => setLimit((value) => value + PAGE)}>
              Show more resources ({items.length - limit} remaining)
            </Button>
          </div>
        )}
      </Section>
    </>
  )
}

function ResourcePathwayGroup({ group, items, onReport, onCorrect }: ResourcePathwayGroupProps) {
  const [visible, setVisible] = useState(8)
  return (
    <Section label={group.label} meta={`${items.length} resources`}>
      {group.description && <p className="catalogGroupDescription">{group.description}</p>}
      <ul className="resourceList">
        {items.slice(0, visible).map((resource: AnyValue) => (
          <ResourceRow
            key={resource.slug}
            resource={resource}
            onReport={onReport}
            onCorrect={onCorrect}
          />
        ))}
      </ul>
      {items.length > visible && (
        <Button sm variant="secondary" onClick={() => setVisible((count) => count + 12)}>
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
