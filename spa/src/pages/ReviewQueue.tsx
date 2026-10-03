import { TbInbox as ReviewIcon } from 'react-icons/tb'
import { PageHeader } from '../components/ui'
import { PageSectionNav } from '../components/PageSectionNav'
import { FeedbackQueue } from '../components/FeedbackQueue'
import { OpportunityReview } from '../components/OpportunityReview'

export function ReviewQueue({ slug }: any) {
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
