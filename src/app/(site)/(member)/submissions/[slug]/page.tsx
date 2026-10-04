'use client'

import { useParams } from 'next/navigation'
import { SubmissionDetail } from '../../../../../member/pages/SubmissionDetail'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <SubmissionDetail slug={slug} />
}
