import type { AnyValue } from '../lib/types'
import { TbLock as Lock } from 'react-icons/tb'
import { A, Button, Empty, PageHeader } from './ui'
import { signOut } from '../lib/session'

interface LockedProps {
  title?: string
  body?: AnyValue
  course?: AnyValue
}

export function Locked({
  title = 'Complete your membership course',
  body = 'Your account is registered. Pass the short membership course to use the rest of the Hub.',
  course = false,
}: LockedProps) {
  return (
    <div>
      <PageHeader icon={Lock} title={title} />
      <Empty
        icon={Lock}
        body={body}
        cta={
          course ? (
            <>
              <A className="btn btn-primary" href="/onboarding/course">
                Start course
              </A>
              <Button variant="ghost" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : undefined
        }
      />
    </div>
  )
}
