# Proposal: add governed email notifications

## Why

YOUNGO Hub has persistent web-push subscriptions, but password resets and
invitations still require a person to copy a link into another channel. Members
also need a dependable way to receive the weekly digest and time-sensitive
deadline reminders defined by the product specification.

The sending path must remain small, auditable, privacy-preserving, and mostly
open source without making the Hub team operate a public mail-transfer agent or
sender-IP reputation.

## What changes

- Add explicit, category-specific email preferences that default off for
  optional email.
- Add a PostgreSQL notification outbox with idempotent enqueueing, delivery
  leases, retry scheduling, and per-member frequency caps.
- Add a provider-neutral SMTP adapter using Nodemailer and responsive MJML
  templates; without SMTP, no real message is emitted.
- Add a separate Railway worker that sends at a bounded rate and suppresses
  permanent failures.
- Add signed, no-login, one-click unsubscribe for every optional message.
- Deliver password-reset links directly to the configured SMTP relay without
  storing or logging the raw credential in the outbox or audit trail.
- Add an authorized, audited admin broadcast endpoint that accepts a governed
  account scope rather than recipient email addresses.

## Non-goals

- No self-hosted public SMTP/MTA or dedicated sending IP in this change.
- No imported, purchased, guardian, DCP, YCP, or public-contact recipient lists.
- No open pixels or personalized click tracking.
- No arbitrary HTML supplied by administrators.
- No email generated from an Intelligence query response.
