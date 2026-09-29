import { TbBooks as LibraryIcon } from 'react-icons/tb'
import { A, PageHeader, Section, Skeletons } from '../components/ui.jsx'
import { useDocument } from '../lib/documents.js'

export function Library() {
  const { doc: library, loading } = useDocument('library')
  if (!library) return loading ? <Skeletons n={3} /> : null
  return (
    <div>
      <PageHeader icon={LibraryIcon} title={library.title} description={library.description} />
      <Section label={library.sectionLabel}>
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
