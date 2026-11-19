'use client'

// Applies route guards, wraps granted pages in the Shell, and sends unverified members to onboarding.
import { useEffect } from 'react'
import { navigate, usePath } from '../lib/router'
import { useAccount } from '../lib/accountContext'
import { lockedFor } from '../lib/guards'
import { Shell } from './Shell'

export function MemberGate({ children }: { children: React.ReactNode }) {
  const path = usePath()
  const { account } = useAccount()
  const verified = Boolean(account?.isVerified)

  useEffect(() => {
    if (account && !verified && path === '/') navigate('/onboarding')
  }, [account, verified, path])

  const locked = lockedFor(path ?? '', account)
  return <Shell>{locked ?? children}</Shell>
}
