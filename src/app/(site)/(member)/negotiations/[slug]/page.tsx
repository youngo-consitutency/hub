'use client'

import { useParams } from 'next/navigation'
import { NegotiationDetail } from '../../../../../member/pages/NegotiationDetail'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <NegotiationDetail slug={slug} />
}
