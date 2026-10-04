'use client'

import { useParams } from 'next/navigation'
import { DecisionPage } from '../../../../../member/features/platform/DecisionPage'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <DecisionPage slug={slug} />
}
