# Design: governed email notifications

## Boundaries

YOUNGO Hub remains the source of truth for recipients, membership state, and
preferences. Email addresses are resolved from `hub_accounts` only at delivery
time. Outbox records carry account IDs and allowlisted template data; they do
not carry recipient addresses, guardian data, minority data, account records,
or rendered email bodies.

The application and worker use open-source components: PostgreSQL,
Nodemailer, and MJML. Production delivery crosses one provider-neutral SMTP
boundary so YOUNGO does not have to operate an internet-facing MTA or establish
a new sending-IP reputation.

## Categories

- `security`: required account-security messages such as password resets.
- `invitation`: required invitations addressed to their intended recipient.
- `digest`: optional weekly followed-scope summary.
- `deadline`: optional submission and decision deadline reminders.
- `announcement`: optional governed staff broadcasts.

Required categories bypass optional preference and frequency caps, but retain
endpoint rate limiting. Optional categories require an active account, a
verified email, an enabled preference, and no applicable suppression.

## Delivery flow

1. A governed mutation or scheduler resolves account IDs source-side.
2. The producer inserts an outbox row with a unique deduplication key.
3. A worker claims rows with a lease and `FOR UPDATE SKIP LOCKED`.
4. Before rendering, the worker rechecks account state, verification,
   preference, suppression, and frequency caps.
5. A fixed template is rendered as HTML and plain text and submitted over TLS
   to SMTP.
6. Success, retryable deferral, permanent failure, or suppression is recorded
   without logging the recipient address or content.

Token-bearing security messages are different: the raw token exists only in
the request process long enough to hand the message to SMTP. It is never
written to the outbox or governance audit. A failed SMTP handoff invalidates
that token, and the user can request another through the enumeration-safe
endpoint.

## Volume and reputation controls

- Optional email defaults off and is enabled explicitly per category.
- Weekly digests are limited to one per seven days.
- Deadline alerts are batched or limited to one per day.
- Announcements are limited to one per day.
- All optional categories together are limited to three per rolling seven
  days per account.
- The worker has configurable per-second and per-day limits and does not burst
  an entire audience concurrently.
- A unique deduplication key prevents repeated producers and schedulers from
  creating a second outbox row.
- SMTP has no portable idempotency operation. Retries reuse a deterministic
  `Message-ID`; a crash after provider acceptance but before the database
  acknowledgement remains an explicitly monitored at-least-once edge case.
- Hard bounces and complaints create a suppression; retryable failures use
  exponential backoff with a maximum attempt count.

## Authorization and audit

`notifications.send` is derived source-side. Admin broadcasts accept only
allowlisted scopes (`all_active`, `working_group`, `team`, or explicit account
IDs), never email addresses. The governance audit records the actor, category,
scope, template, deduplication campaign ID, and recipient count, but not email
addresses or body content.

## Unsubscribe

Optional messages contain a visible link plus RFC 8058-compatible
`List-Unsubscribe` and `List-Unsubscribe-Post` headers. The link contains a
versioned HMAC-signed account/category token and performs an idempotent disable
without requiring a session. Security and invitation messages do not include
an optional-category unsubscribe.

## Operations

Production adds a `worker` Railway service using the same image and
`node server/worker.js` start command. SMTP configuration is validated at
worker startup. Development without SMTP can create fixture outbox metadata but
never emits a real message. Staging must use a capture mailbox or an
explicit recipient allowlist before production promotion. The selected relay's
signed bounce and complaint events are mapped into the Hub's authenticated,
provider-neutral suppression adapter.
