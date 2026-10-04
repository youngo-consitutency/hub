import type { AnyValue } from '../lib/types'
import { A, Section, Skeletons, Empty, ErrorCard } from './ui'
import { useDocument } from '../lib/documents'

/** Load published library guides, with loading, retry and empty states. */
export function ResourceGuides() {
  const { doc: library, loading, error, retry } = useDocument('library')
  if (loading) return <Skeletons n={3} />
  if (error) return <ErrorCard message={error} onRetry={retry} />
  if (!library?.guides?.length) return <Empty title="No guides published yet" />
  return (
    <div>
      <Section label={library.sectionLabel}>
        {library.description && <p className="sectionIntro">{library.description}</p>}
        <div className="resourceList">
          {(library.guides || []).map((guide: AnyValue) => (
            <A key={guide.title} href={guide.href} className="resourceRow">
              <span className="resourceCopy">
                <strong>{guide.title}</strong>
                <span className="meta">{guide.body}</span>
              </span>
            </A>
          ))}
        </div>
      </Section>
    </div>
  )
}
