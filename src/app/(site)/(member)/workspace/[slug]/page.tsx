'use client'

import { useParams } from 'next/navigation'
import { Workspace } from '../../../../../member/pages/Workspace'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <Workspace slug={slug} />
}
