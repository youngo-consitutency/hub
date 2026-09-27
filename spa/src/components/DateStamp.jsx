const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Compact calendar date, shared by public previews and member event cards. */
export function DateStamp({ iso }) {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return null
  return (
    <time className="dateStamp" dateTime={iso} aria-label={dateFormat.format(date)}>
      <span>{monthFormat.format(date)}</span>
      <strong>{date.getDate()}</strong>
    </time>
  )
}
