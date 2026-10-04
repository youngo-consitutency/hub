'use client'

import { useParams } from 'next/navigation'
import { GroupDetail } from '../../../../../member/pages/GroupDetail'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <GroupDetail slug={slug} />
}
