import type { AnyValue } from '../lib/types'
import { TbBooks as ResourcesIcon } from 'react-icons/tb'
import { useState } from 'react'
import { ResourceGuides } from '../components/ResourceGuides'
import { useSearch } from 'wouter'
import { PageHeader, A } from '../components/ui'
import { useAccount } from '../lib/accountContext'
import { ResourceCatalogue, ResourceSubmissionPanel } from '../components/ResourceHub'

/** Select the catalogue or guides from the URL and show contribution controls for eligible accounts. */
export function Resources() {
  const search = useSearch()
  const guides = new URLSearchParams(search).get('view') === 'guides'
  const { account } = useAccount()
  const [correction, setCorrection] = useState<AnyValue>(null)
  const canReview = account?.access?.capabilities?.includes('content.review')
  return (
    <div>
      <PageHeader
        icon={ResourcesIcon}
        title="Resources"
        description="Research, guides and learning materials collected by YOUNGO."
        action={
          canReview ? (
            <A className="btn btn-secondary" href="/resources/issues">
              Issues & verification
            </A>
          ) : null
        }
      >
        <nav className="pageSectionNav" aria-label="Resources">
          <A
            href="/resources"
            className={`pageSectionLink ${!guides ? 'active' : ''}`}
            aria-current={!guides ? 'page' : undefined}
          >
            Catalogue
          </A>
          <A
            href="/resources?view=guides"
            className={`pageSectionLink ${guides ? 'active' : ''}`}
            aria-current={guides ? 'page' : undefined}
          >
            Guides
          </A>
        </nav>
      </PageHeader>
      {guides ? (
        <ResourceGuides />
      ) : (
        <ResourceCatalogue onCorrect={account?.isVerified ? setCorrection : null} />
      )}
      {!guides && account?.isVerified && (
        <ResourceSubmissionPanel
          key={correction?.slug || 'new'}
          initialResource={correction}
          onCancel={() => setCorrection(null)}
        />
      )}
    </div>
  )
}
