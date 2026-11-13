---
name: hub-data
description: Migrations, provisioning, and test data — where data may and may not live.
triggers: [user, model]
---

# Data rules

## Migrations (`src/db/migrations/`)

- Structure only — schema, indexes, enum rebuilds. Never insert operational content or accounts.
- Postgres can't remove enum values: rebuild the type (drop default → retype → restore), see `20261120_120000_account_role_member_only.ts`.
- Name a new migration after the LATEST existing timestamp, not today's date (names already run past 20261203); Payload applies them in filename order.
- Rollback restores shape, not data — note it in a comment when a migration folds data.

## Provisioning

- There is no seed script (no `npm run seed`); everything is provisioned at runtime (below).
- Accounts, sample content, and test populations are provisioned at runtime — `tests/int/provision.ts` (`provisionAccount`, `testPayload`) for specs; staff scripts under `scripts/setup/` for real environments.
- NEVER commit emails, names, fictional member records, or content strings to source. If you need a document's body, provision it in the target database.

## Staff-editable content

- Labels, option lists, policy text, and versions live in `content-documents` — read via `useDocument('<slug>')` client-side or the documents endpoint server-side. Code reads the CURRENT version; it doesn't ship copies.

## Tests

- `npm run test:int` needs a running server (`npm run dev`, or `npm start` after a build) and a migrated local Postgres (`DATABASE_URL` must point at localhost; the README container uses :5433, CI uses :5432). Specs provision their own accounts/content per run — keep them self-contained.
- Login is rate-limited (20/15min in-memory); `HUB_DISABLE_RATE_LIMIT=1` opts the local test server out.
