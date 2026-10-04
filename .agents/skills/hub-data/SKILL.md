---
name: hub-data
description: Migrations, seeding, provisioning, and test data — where data may and may not live.
triggers: [user, model]
---

# Data rules

## Migrations (`src/db/migrations/`)

- Structure only — schema, indexes, enum rebuilds. Never insert operational content or accounts.
- Postgres can't remove enum values: rebuild the type (drop default → retype → restore), see `20261120_120000_account_role_member_only.ts`.
- Rollback restores shape, not data — note it in a comment when a migration folds data.

## Provisioning

- Baseline structure (policy scaffolding) comes from `npm run seed` → `scripts/seed.ts`.
- Accounts, sample content, and test populations are provisioned at runtime — `tests/int/provision.ts` (`provisionAccount`, `testPayload`) for specs; staff scripts under `scripts/setup/` for real environments.
- NEVER commit emails, names, fictional member records, or content strings to source. If you need a document's body, provision it in the target database.

## Staff-editable content

- Labels, option lists, policy text, and versions live in `content-documents` — read via `useDocument('<slug>')` client-side or the documents endpoint server-side. Code reads the CURRENT version; it doesn't ship copies.

## Tests

- `npm run test:int` needs `npm run dev` + a migrated Postgres on :5433. Specs provision their own accounts/content per run — keep them self-contained.
- Login is rate-limited (20/15min in-memory); `HUB_DISABLE_RATE_LIMIT=1` opts the local test server out.
