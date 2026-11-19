// from nextjs, not @sentry/core: a separate core copy drifts and the types clash
import type { ErrorEvent } from '@sentry/nextjs'

// Shared beforeSend scrubbing: credentials and member-identifying fields
// never leave the process.

// v11 replacement for `sendDefaultPii: false` — leaving dataCollection
// unset would collect more than the old restrictive default.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  },
  httpBodies: [],
  urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
}
const SENSITIVE_FIELD =
  /pass(word)?|pwd|token|secret|authorization|cookie|session|api[-_]?key|bearer|credential|email|phone|first[_-]?name|last[_-]?name|guardian|minority|dob|date[_-]?of[_-]?birth|gender|under18/i

const FILTERED = '[Filtered]'

// a malformed %-sequence throws URIError; scrubbing must never break error reporting
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function scrubQuery(query: unknown): unknown {
  if (typeof query !== 'string' || !query) return query
  return query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=')
      const key = eq === -1 ? pair : pair.slice(0, eq)
      return SENSITIVE_FIELD.test(safeDecode(key.replace(/\+/g, ' '))) ? `${key}=${FILTERED}` : pair
    })
    .join('&')
}

// tokens travel in some paths (NGO invites, unsubscribe and verification links)
const TOKEN_PATH = /(\/(?:invite|unsubscribe|verify-email|reset-password)\/)[^/?#\s]+/gi
const EMAIL_ADDRESS = /[^\s@()'"]+@[^\s@()'"]+\.[^\s@()'"]+/g
// Postgres reports offending values: Key (email)=(someone@example.org) already exists
const PG_KEY_VALUE = /Key \([^)]*\)=\([^)]*\)/g

function scrubUrl(url: string): string {
  const [path, query] = url.split('?')
  const safePath = path.replace(TOKEN_PATH, `$1${FILTERED}`)
  return query === undefined ? safePath : `${safePath}?${scrubQuery(query)}`
}

function scrubMessage(message: string): string {
  return message
    .replace(PG_KEY_VALUE, `Key ${FILTERED}`)
    .replace(EMAIL_ADDRESS, FILTERED)
    .replace(TOKEN_PATH, `$1${FILTERED}`)
}

// Generic so callers keep the field's declared type; the walk itself is shape-agnostic.
function scrubValue<T>(value: T, depth = 0): T {
  if (depth > 6 || value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1)) as T
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_FIELD.test(key) ? FILTERED : scrubValue(item, depth + 1),
    ]),
  ) as T
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.headers) event.request.headers = scrubValue(event.request.headers)
    if (event.request.cookies) event.request.cookies = scrubValue(event.request.cookies)
    if (event.request.data != null) event.request.data = scrubValue(event.request.data)
    if (event.request.url) event.request.url = scrubUrl(event.request.url)
    if (event.request.query_string)
      event.request.query_string = scrubQuery(event.request.query_string) as string
  }
  // Keep the opaque account id for correlation; drop every identifying field.
  if (event.user) event.user = { id: event.user.id }
  if (event.extra) event.extra = scrubValue(event.extra)
  if (typeof event.extra?.path === 'string') event.extra.path = scrubUrl(event.extra.path)
  if (event.message) event.message = scrubMessage(event.message)
  for (const exception of event.exception?.values ?? [])
    if (exception.value) exception.value = scrubMessage(exception.value)
  if (event.contexts) event.contexts = scrubValue(event.contexts)
  if (event.breadcrumbs)
    for (const crumb of event.breadcrumbs) if (crumb.data) crumb.data = scrubValue(crumb.data)
  return event
}
