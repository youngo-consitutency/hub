import { PageHeader } from '../components/ui.jsx'
import {
  ResourceCatalogue,
  ResourceSubmissionPanel,
} from '../components/ResourceHub.jsx'

export function Resources() {
  return (
    <div>
      <PageHeader
        title="Science resources"
        description="Reviewed climate research, learning, career, and funding resources for young people and youth-led organisations."
      />
      <ResourceCatalogue />
      <ResourceSubmissionPanel />
    </div>
  )
}
