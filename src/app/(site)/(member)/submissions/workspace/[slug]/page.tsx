'use client'

import { useParams } from 'next/navigation'
import { SubmissionWorkspace } from '../../../../../../member/pages/SubmissionWorkspace'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <SubmissionWorkspace slug={slug} />
}
