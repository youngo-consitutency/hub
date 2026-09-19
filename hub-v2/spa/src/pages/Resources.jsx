import { TbBooks as ResourcesIcon } from 'react-icons/tb'
import { useState } from 'react'
import { PageHeader, A } from '../components/ui.jsx'
import { useAccount } from '../lib/accountContext.jsx'
import {
  ResourceCatalogue,
  ResourceSubmissionPanel,
} from '../components/ResourceHub.jsx'

export function Resources() {
  const { account } = useAccount()
  const [correction, setCorrection] = useState(null)
  const canReview = account?.access?.capabilities?.includes('content.review')
  return (
    <div>
      <PageHeader
        icon={ResourcesIcon}
        title="Science resources"
        description="Climate research, learning, career, and funding resources, organised and maintained by the community."
        action={
          canReview ? (
            <A className="btn btn-secondary" href="/resources/issues">
              Issues & verification
            </A>
          ) : null
        }
      />
      <ResourceCatalogue
        onCorrect={account?.isVerified ? setCorrection : null}
      />
      {account?.isVerified && (
        <ResourceSubmissionPanel
          key={correction?.slug || 'new'}
          initialResource={correction}
          onCancel={() => setCorrection(null)}
        />
      )}
    </div>
  )
}
