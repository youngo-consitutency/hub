'use client'

import { RouteError } from '../../member/components/RouteError'

// catches failures in the member layout itself (gates, providers)
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />
}
