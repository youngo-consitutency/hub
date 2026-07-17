# Change: add-public-mvp

## Why

YOUNGO's information is scattered across WhatsApp groups, mailing lists, and shared
drives. Members — new ones especially — cannot reliably find open submissions, meeting
times in their timezone, upcoming LCOYs/RCOYs, decisions moving through the DMP, or who
to contact. The spec package (`../docs/specs/youngo/`) is complete; this change builds
the public read-only MVP (Phase 0 foundations + Phase 1) so a seed-content sprint and
soft launch can happen.

## What Changes

- New repo scaffold: React 19 + Vite PWA client, Express API, fixture-fallback data
  layer, Postgres migration 001, tests, lint, dev scripts.
- Verdant design system implemented as `tokens.css` + component library, proven by a
  `/gallery` page (Phase 0 gate).
- Public member views: home feed, calendar (agenda + filters), submissions (open +
  archive), Council (DMP decisions in progress + decided), COY tracker, working groups,
  directory (roles only), basic search.
- Public API endpoints backing those views, per `04-api-data-spec.md`.
- Deferred to follow-up changes (already specified in the canonical docs):
  `add-ics-feeds`, `add-share-cards`, `add-admin-panel`, `add-coy-intake`,
  `add-pwa-shell`, `add-members-auth` (P2), `add-session-mode` (P2), `add-ai-assist` (P3).

## Impact

- Affected specs: home-feed, calendar, submissions, council, coy-tracker,
  working-groups, directory, search (all ADDED — greenfield).
- Affected code: entire `youngo-hub` repo (new).
- No auth, no writes, no personal data in this change; directory shows roles +
  generic emails only, so privacy exposure is nil until `add-members-auth`.
