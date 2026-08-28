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
import {
  RESOURCE_LANGUAGES,
  RESOURCE_PATHWAYS,
  RESOURCE_REGIONS,
  RESOURCE_SOURCE,
  RESOURCE_TOPICS,
  RESOURCE_TYPES,
  resourceLabel,
} from '../../shared/resourceHub.js'
import { apiPatch, apiPost, useApi } from '../lib/api.js'
import { useAccount } from '../lib/accountContext.jsx'
import { FieldError } from './FormControls.jsx'
import {
  Async,
  Button,
  Empty,
  ErrorCard,
  FilterChip,
  FilterPill,
  Section,
  StatusChip,
} from './ui.jsx'

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

const EMPTY_RESOURCE = {
  title: '',
  url: '',
  summary: '',
  publisher: '',
  pathway: 'research',
  type: 'guide',
  topic: 'Climate basics',
  region: 'global',
  language: 'English',
}

function ResourceCard({ resource }) {
  const PathwayIcon = PATHWAY_ICONS[resource.pathway] || BookOpen
  const TypeIcon = TYPE_ICONS[resource.type] || BookOpen
  return (
    <article className="card resourceHubCard">
      <div className="resourceHubCardTop">
        <span className="iconTile" aria-hidden>
          <PathwayIcon size={19} strokeWidth={1.75} />
        </span>
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
        {resource.publisher && (
          <p className="metaMuted">{resource.publisher}</p>
        )}
        <p className="meta">{resource.summary}</p>
      </div>
      <div className="chipRow resourceHubTags" aria-label="Resource metadata">
        <FilterChip icon={TypeIcon} tone="accent">
          {resourceLabel(RESOURCE_TYPES, resource.type)}
        </FilterChip>
        <FilterChip icon={Filter}>{resource.topic}</FilterChip>
        <FilterChip icon={Map}>
          {resourceLabel(RESOURCE_REGIONS, resource.region)}
        </FilterChip>
        <FilterChip icon={Language}>{resource.language}</FilterChip>
      </div>
    </article>
  )
}

export function ResourceCatalogue({ heading = 'Reviewed resources' }) {
  const query = useApi('/resources')
  const [search, setSearch] = useState('')
  const [pathway, setPathway] = useState('all')
  const [type, setType] = useState('all')
  const [topic, setTopic] = useState('all')

  const items = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean)
    return (query.data?.items || []).filter((item) => {
      const haystack = [
        item.title,
        item.summary,
        item.publisher,
        item.topic,
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
        (topic === 'all' || item.topic === topic)
      )
    })
  }, [pathway, query.data?.items, search, topic, type])

  return (
    <>
      <section
        className="card resourceSourceCard"
        aria-labelledby="science-source-title"
      >
        <span className="iconTile" aria-hidden>
          <Research size={21} strokeWidth={1.75} />
        </span>
        <div>
          <p className="pageEyebrow">Existing collection</p>
          <h2 id="science-source-title">{RESOURCE_SOURCE.title}</h2>
          <p className="meta">{RESOURCE_SOURCE.description}</p>
        </div>
        <a
          className="btn btn-secondary btn-sm"
          href={RESOURCE_SOURCE.url}
          target="_blank"
          rel="noreferrer"
        >
          Browse collection
          <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
        </a>
      </section>

      <Section
        label={heading}
        meta={query.data ? `${items.length} listed` : null}
      >
        <div className="resourceHubControls">
          <label className="searchInputWrap resourceHubSearch">
            <Search size={18} strokeWidth={1.75} aria-hidden />
            <span className="srOnly">Search resources</span>
            <input
              className="input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search resources"
            />
          </label>
          <div className="resourceHubFilterRows">
            <div className="pillRow" aria-label="Pathway">
              <FilterPill
                active={pathway === 'all'}
                icon={World}
                onClick={() => setPathway('all')}
              >
                All pathways
              </FilterPill>
              {RESOURCE_PATHWAYS.map((item) => (
                <FilterPill
                  key={item.value}
                  active={pathway === item.value}
                  icon={PATHWAY_ICONS[item.value]}
                  onClick={() => setPathway(item.value)}
                >
                  {item.label}
                </FilterPill>
              ))}
            </div>
            <div className="resourceHubSelects">
              <label>
                <span>Type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="all">All types</option>
                  {RESOURCE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Topic</span>
                <select
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                >
                  <option value="all">All topics</option>
                  {RESOURCE_TOPICS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <Async query={query} skeletons={4}>
          {() =>
            items.length ? (
              <div className="resourceHubGrid">
                {items.map((resource) => (
                  <ResourceCard key={resource.slug} resource={resource} />
                ))}
              </div>
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
      </Section>
    </>
  )
}

export function ResourceSubmissionPanel() {
  const { account } = useAccount()
  const submissions = useApi('/member/resources/submissions/mine')
  const [payload, setPayload] = useState(EMPTY_RESOURCE)
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})

  if (!account?.isVerified) return null

  const set = (key, value) =>
    setPayload((current) => ({ ...current, [key]: value }))
  const reset = () => {
    setPayload(EMPTY_RESOURCE)
    setEditingId(null)
    setOpen(false)
    setFields({})
  }
  const edit = (item) => {
    setPayload({ ...EMPTY_RESOURCE, ...item.payload })
    setEditingId(item.id)
    setOpen(true)
    setMessage('')
    setError('')
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    setFields({})
    try {
      if (editingId)
        await apiPatch(`/member/resources/submissions/${editingId}`, payload)
      else await apiPost('/member/resources/submissions', payload)
      setMessage('Resource sent to the Content Publisher review queue.')
      reset()
      submissions.retry()
    } catch (submissionError) {
      setError(submissionError.message)
      setFields(submissionError.fields || {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      label="Suggest a resource"
      action={
        <Button
          sm
          variant={open ? 'ghost' : 'primary'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Close form' : 'Add resource'}
        </Button>
      }
    >
      <p className="sectionIntro">
        Share a useful public resource. A Content Publisher checks the link,
        description, and tags before it becomes public.
      </p>
      {message && (
        <div className="noticeBanner">
          <span className="noticeDot" />
          <p>{message}</p>
        </div>
      )}
      {error && <ErrorCard message={error} />}
      {open && (
        <form className="card resourceSubmissionForm" onSubmit={submit}>
          <div className="formGrid">
            <label>
              Title
              <input
                required
                value={payload.title}
                onChange={(event) => set('title', event.target.value)}
              />
              <FieldError msg={fields.title} />
            </label>
            <label>
              Public link
              <input
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
              required
              rows="4"
              value={payload.summary}
              onChange={(event) => set('summary', event.target.value)}
            />
            <FieldError msg={fields.summary} />
          </label>
          <div className="formGrid resourceFormTaxonomy">
            <label>
              Pathway
              <select
                value={payload.pathway}
                onChange={(event) => set('pathway', event.target.value)}
              >
                {RESOURCE_PATHWAYS.map((item) => (
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
                value={payload.type}
                onChange={(event) => set('type', event.target.value)}
              >
                {RESOURCE_TYPES.map((item) => (
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
                value={payload.topic}
                onChange={(event) => set('topic', event.target.value)}
              >
                {RESOURCE_TOPICS.map((item) => (
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
                value={payload.region}
                onChange={(event) => set('region', event.target.value)}
              >
                {RESOURCE_REGIONS.map((item) => (
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
                value={payload.language}
                onChange={(event) => set('language', event.target.value)}
              >
                {RESOURCE_LANGUAGES.map((item) => (
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
                value={payload.publisher}
                onChange={(event) => set('publisher', event.target.value)}
              />
              <FieldError msg={fields.publisher} />
            </label>
          </div>
          <div className="resourceSubmissionActions">
            <Button type="submit" variant="primary" disabled={busy}>
              <Send size={16} strokeWidth={1.75} aria-hidden />
              {busy
                ? 'Sending…'
                : editingId
                  ? 'Resubmit for review'
                  : 'Send for review'}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      <Async query={submissions} skeletons={2}>
        {(data) =>
          data.items.length ? (
            <div className="resourceSubmissionList">
              {data.items.map((item) => (
                <article
                  key={item.id}
                  className="card cardTight resourceSubmissionItem"
                >
                  <div>
                    <strong>{item.payload.title}</strong>
                    <p className="meta">Submitted resource</p>
                    {item.reviewNote && (
                      <p className="contentReviewNote">
                        Review note: {item.reviewNote}
                      </p>
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
