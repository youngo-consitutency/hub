'use client'

import { useParams } from 'next/navigation'
import { EventDetail } from '../../../../../member/pages/EventDetail'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <EventDetail slug={slug} />
}
