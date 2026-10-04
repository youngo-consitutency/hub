'use client'

import { useParams } from 'next/navigation'
import { TaskForce } from '../../../../../../member/pages/TaskForce'

export default function Page() {
  const { slug, extra } = useParams<{ slug: string; extra: string }>()
  return <TaskForce slug={slug} extra={extra} />
}
