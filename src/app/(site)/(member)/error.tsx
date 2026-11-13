'use client'

import { RouteError } from '../../../member/components/RouteError'

// keeps the shell (layout) on screen and replaces only the page
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />
}
