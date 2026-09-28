import type { ErrorEvent } from '@sentry/core'

// Shared beforeSend scrubbing for server, edge and browser runtimes.
// Credentials and member-identifying fields never leave the process —
// sendDefaultPii stays off everywhere and this strips anything that still
// arrives via request payloads, headers, breadcrumbs or extras.
const SENSITIVE_FIELD =
  /pass(word)?|pwd|token|secret|authorization|cookie|session|api[-_]?key|bearer|credential|email|phone|first[_-]?name|last[_-]?name/i

const FILTERED = '[Filtered]'

function scrubQuery(query: unknown): unknown {
  if (typeof query !== 'string' || !query) return query
  return query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=')
      const key = eq === -1 ? pair : pair.slice(0, eq)
      return SENSITIVE_FIELD.test(decodeURIComponent(key.replace(/\+/g, ' ')))
        ? `${key}=${FILTERED}`
        : pair
    })
    .join('&')
}

function scrubValue(value: any, depth = 0): any {
  if (depth > 6 || value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1))
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_FIELD.test(key) ? FILTERED : scrubValue(item, depth + 1),
    ]),
  )
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.headers)
      event.request.headers = scrubValue(event.request.headers)
    if (event.request.cookies)
      event.request.cookies = scrubValue(event.request.cookies)
    if (event.request.data != null)
      event.request.data = scrubValue(event.request.data)
    if (event.request.query_string)
      event.request.query_string = scrubQuery(event.request.query_string) as string
  }
  // Keep the opaque account id for correlation; drop every identifying field.
  if (event.user) event.user = { id: event.user.id }
  if (event.extra) event.extra = scrubValue(event.extra)
  if (event.contexts) event.contexts = scrubValue(event.contexts)
  if (event.breadcrumbs)
    for (const crumb of event.breadcrumbs)
      if (crumb.data) crumb.data = scrubValue(crumb.data)
  return event
}
