'use client'

import { useParams } from 'next/navigation'
import { CoyDetail } from '../../../../../member/pages/CoyDetail'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <CoyDetail slug={slug} />
}
