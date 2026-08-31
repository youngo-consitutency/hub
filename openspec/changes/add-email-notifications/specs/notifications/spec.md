# Email notification specification

## Requirement: explicit optional preferences

The system SHALL default optional email categories off and SHALL send them only
after the member enables the category for their verified account address.

#### Scenario: existing account has no preference

- **WHEN** an existing account has no stored digest preference
- **THEN** the system treats weekly digest email as disabled.

#### Scenario: transactional security email

- **WHEN** a member requests a password reset
- **THEN** the enumeration-safe response is unchanged
- **AND** the raw reset URL is submitted directly to configured SMTP
- **AND** the raw URL is absent from the outbox, audit trail, and production logs.

## Requirement: source-side recipient resolution

The system SHALL resolve recipients from `hub_accounts` and membership scope at
the source. It SHALL NOT accept account contact fields, guardian details, or
arbitrary recipient email addresses for a member broadcast.

#### Scenario: governed broadcast

- **WHEN** an actor with `notifications.send` requests an announcement to an
  allowlisted scope
- **THEN** the server resolves eligible account IDs, enqueues one message per
  account, and audits only the scope and aggregate recipient count.

#### Scenario: unauthorized broadcast

- **WHEN** an ordinary member requests a broadcast
- **THEN** the system responds `403` and enqueues nothing.

## Requirement: bounded and idempotent delivery

Optional delivery SHALL enforce per-account frequency caps, configurable worker
throughput, retry limits, and unique deduplication keys.

#### Scenario: scheduler or producer restart

- **WHEN** a scheduler or producer repeats an enqueue operation
- **THEN** the same deduplication key cannot create a second outbox row.

#### Scenario: member unsubscribes while queued

- **WHEN** an optional message is queued and the member disables that category
  before delivery
- **THEN** the worker suppresses the message instead of sending it.

## Requirement: one-click unsubscribe

Every optional email SHALL contain a visible category unsubscribe link and
one-click unsubscribe headers using a signed token that requires no login.

#### Scenario: valid unsubscribe

- **WHEN** an email client posts a valid one-click token
- **THEN** that account/category preference becomes disabled idempotently.

#### Scenario: tampered unsubscribe

- **WHEN** a token signature or category is invalid
- **THEN** the system changes no preference and responds with a generic invalid-link result.

## Requirement: privacy-preserving operations

Operational records and logs SHALL use account IDs, provider IDs, error codes,
and aggregate counts. They SHALL NOT store recipient email addresses, rendered
bodies, credentials, guardian data, or minority data.
