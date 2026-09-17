import { TbInbox as ReviewIcon } from 'react-icons/tb'
import { PageHeader } from '../components/ui.jsx'
import { PageSectionNav } from '../components/PageSectionNav.jsx'
import { FeedbackQueue } from '../components/FeedbackQueue.jsx'
import { OpportunityReview } from '../components/OpportunityReview.jsx'

export function ReviewQueue({ slug }) {
  return (
    <div>
      <PageHeader
        icon={ReviewIcon}
        title="Review queue"
        description="Respond to member feedback and review organisation postings."
      >
        <PageSectionNav section="review" />
      </PageHeader>
      {slug === 'opportunities' ? <OpportunityReview /> : <FeedbackQueue />}
    </div>
  )
}
