'use client'

import { useParams } from 'next/navigation'
import { CpManage } from '../../../../../member/pages/CpManage'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  return <CpManage slug={slug} />
}
