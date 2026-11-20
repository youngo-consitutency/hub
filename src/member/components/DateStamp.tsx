import { fmtDate } from '../lib/time'

interface DateStampProps {
  iso: string
}

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short' })

/** Compact calendar date, shared by public previews and member event cards. */
export function DateStamp({ iso }: DateStampProps) {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return null
  return (
    <time className="dateStamp" dateTime={iso}>
      <span aria-hidden>{monthFormat.format(date)}</span>
      <strong aria-hidden>{date.getDate()}</strong>
      <span className="srOnly">{fmtDate(date)}</span>
    </time>
  )
}
