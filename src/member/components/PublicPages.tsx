'use client'

import type { AnyValue, Doc } from '../lib/types'
import { useState } from 'react'
import {
  TbArrowDown as ArrowDown,
  TbArrowUp as ArrowUp,
  TbFileText as FileText,
  TbPlus as Plus,
  TbTrash as Trash,
} from 'react-icons/tb'
import { apiPatch, apiPost } from '../lib/api'
import { formatDateTime } from '../lib/time'
import { Button, ErrorCard, Section } from './ui'
import { FieldError } from './FormControls'
import { SidePanel } from './SidePanel'

const PAGE_LABEL: Record<string, string> = { faq: 'FAQ', contact: 'Contact' }
const STATE_LABEL: Record<string, [string, string]> = {
  baseline: ['chip-neutral', 'Baseline'],
  published: ['chip-accent', 'Published'],
  unpublished: ['chip-warn', 'Withdrawn'],
}

export type PageEdit = { payload: Doc; draftId?: number; revision?: number }

const sectionId = (title: string, taken: Set<string>) => {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section'
  let id = base
  for (let i = 2; taken.has(id); i += 1) id = `${base}-${i}`
  return id
}

/** Draft payload from the page as it is live now, recording that base. */
export function pageDraftFrom(page: Doc): Doc {
  return {
    ...page.document,
    baseRevisionId: page.revisionId,
    basePublicationStatus: page.state,
  }
}

export function PublicPagesSection({
  pages,
  canDraft,
  canPublish,
  onEdit,
  onChanged,
}: {
  pages: Doc[]
  canDraft: boolean
  canPublish: boolean
  onEdit: (edit: PageEdit) => void
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const withdraw = async (page: Doc) => {
    const reason = window
      .prompt(`Why is the ${PAGE_LABEL[page.slug]} page being withdrawn?`)
      ?.trim()
    if (!reason) return
    setError(null)
    try {
      await apiPost(`/member/content/pages/${page.slug}/unpublish`, {
        revisionId: page.revisionId,
        reason,
      })
      onChanged()
    } catch (e) {
      setError((e as AnyValue).message)
    }
  }
  return (
    <Section label="Public pages">
      {error && <ErrorCard message={error} />}
      <div className="grid2">
        {pages.map((page) => {
          const [chip, label] = STATE_LABEL[page.state] || STATE_LABEL.baseline
          return (
            <article key={page.slug} className="card cardTight publicPageCard">
              <div className="rowBetween">
                <span className="rowGap">
                  <FileText size={18} aria-hidden />
                  <strong>{PAGE_LABEL[page.slug]}</strong>
                </span>
                <span className={`chip ${chip}`}>{label}</span>
              </div>
              <p className="meta">
                {page.document?.title} · {page.document?.sections?.length || 0} sections
                {page.publishedAt ? ` · ${formatDateTime(page.publishedAt)}` : ''}
              </p>
              <div className="rowGap">
                {canDraft && (
                  <Button
                    sm
                    variant="secondary"
                    onClick={() => onEdit({ payload: pageDraftFrom(page) })}
                  >
                    Draft a change
                  </Button>
                )}
                {canPublish && page.state === 'published' && (
                  <Button sm variant="ghost" onClick={() => withdraw(page)}>
                    Withdraw
                  </Button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

export function PublicPageEditor({
  edit,
  onClose,
  onSaved,
}: {
  edit: PageEdit
  onClose: () => void
  onSaved: () => void
}) {
  const [page, setPage] = useState<Doc>(edit.payload)
  const [fields, setFields] = useState<Doc>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sections: Doc[] = page.sections || []
  const setSections = (next: Doc[]) => setPage((p) => ({ ...p, sections: next }))
  const updateSection = (i: number, patch: Doc) =>
    setSections(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const move = (i: number, by: number) => {
    const next = [...sections]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setSections(next)
  }
  const addSection = () =>
    setSections([
      ...sections,
      { id: sectionId('new section', new Set(sections.map((s) => s.id))), title: '', body: '' },
    ])

  const save = async () => {
    setBusy(true)
    setError(null)
    setFields({})
    // an empty link pair means no link
    const payload = {
      ...page,
      sections: sections.map(({ linkUrl, linkLabel, ...rest }) =>
        linkUrl?.trim() ? { ...rest, linkUrl: linkUrl.trim(), linkLabel: linkLabel?.trim() } : rest,
      ),
    }
    try {
      if (edit.draftId)
        await apiPatch(`/member/content/drafts/${edit.draftId}`, {
          payload,
          expectedVersion: edit.revision,
        })
      else await apiPost('/member/content/drafts', { contentType: 'page', payload })
      onSaved()
    } catch (e) {
      setFields((e as AnyValue).fields || {})
      setError((e as AnyValue).fields ? 'Check the highlighted fields.' : (e as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SidePanel title={`${PAGE_LABEL[page.slug]} page draft`} onClose={onClose}>
      <div className="stack publicPageEditor">
        <p className="metaMuted">
          Drafted from the {page.basePublicationStatus === 'baseline' ? 'baseline' : 'live'} page.
          It goes live only after an independent review and publish.
        </p>
        {error && <ErrorCard message={error} />}
        <label className="field">
          <span>Title</span>
          <input
            className="input"
            maxLength={160}
            value={page.title || ''}
            onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))}
          />
          <FieldError msg={fields.title} />
        </label>
        <label className="field">
          <span>Introduction</span>
          <textarea
            className="input textarea"
            rows={3}
            maxLength={1000}
            value={page.intro || ''}
            onChange={(e) => setPage((p) => ({ ...p, intro: e.target.value }))}
          />
          <FieldError msg={fields.intro} />
        </label>

        <div className="publicPageSections">
          {sections.map((section, i) => (
            <fieldset key={section.id} className="card cardTight publicPageSection">
              <legend className="meta">Section {i + 1}</legend>
              <label className="field">
                <span>{page.slug === 'faq' ? 'Question' : 'Heading'}</span>
                <input
                  className="input"
                  maxLength={160}
                  value={section.title}
                  onChange={(e) => updateSection(i, { title: e.target.value })}
                />
              </label>
              <label className="field">
                <span>{page.slug === 'faq' ? 'Answer' : 'Text'}</span>
                <textarea
                  className="input textarea"
                  rows={3}
                  maxLength={4000}
                  value={section.body}
                  onChange={(e) => updateSection(i, { body: e.target.value })}
                />
              </label>
              <div className="formRow">
                <label className="field">
                  <span>Link label</span>
                  <input
                    className="input"
                    maxLength={80}
                    value={section.linkLabel || ''}
                    onChange={(e) => updateSection(i, { linkLabel: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Link (/path or https://)</span>
                  <input
                    className="input"
                    maxLength={500}
                    value={section.linkUrl || ''}
                    onChange={(e) => updateSection(i, { linkUrl: e.target.value })}
                  />
                </label>
              </div>
              <div className="rowGap">
                <Button
                  sm
                  variant="ghost"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={15} aria-hidden />
                </Button>
                <Button
                  sm
                  variant="ghost"
                  aria-label="Move down"
                  disabled={i === sections.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={15} aria-hidden />
                </Button>
                <Button
                  sm
                  variant="ghost"
                  aria-label="Remove section"
                  disabled={sections.length <= 1}
                  onClick={() => setSections(sections.filter((_, j) => j !== i))}
                >
                  <Trash size={15} aria-hidden />
                </Button>
              </div>
            </fieldset>
          ))}
          <FieldError msg={fields.sections} />
          <Button sm variant="ghost" disabled={sections.length >= 30} onClick={addSection}>
            <Plus size={15} aria-hidden />
            Add section
          </Button>
        </div>
        <FieldError msg={fields.baseRevisionId || fields.payload || fields.expectedVersion} />
        <div className="rowGap">
          <Button variant="primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : edit.draftId ? 'Update draft' : 'Save draft'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </SidePanel>
  )
}

/** Read-only view of a page draft for the review queue. */
export function PageDraftPreview({ payload }: { payload: Doc }) {
  return (
    <details className="publicPagePreview">
      <summary className="meta">Preview {payload.sections?.length || 0} sections</summary>
      <p className="meta">{payload.intro}</p>
      <ol>
        {(payload.sections || []).map((s: Doc) => (
          <li key={s.id}>
            <strong>{s.title}</strong>
            <p className="meta">{s.body}</p>
            {s.linkUrl && (
              <p className="metaMuted">
                {s.linkLabel} → {s.linkUrl}
              </p>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
