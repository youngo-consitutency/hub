import { A, Section, Skeletons, Empty, ErrorCard } from './ui.jsx'
import { useDocument } from '../lib/documents.js'

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
          {(library.guides || []).map((guide) => (
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
