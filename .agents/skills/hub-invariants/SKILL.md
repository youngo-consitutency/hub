---
name: hub-invariants
description: Non-negotiable rules for any change to the YOUNGO Hub. Read before editing code, schema, endpoints, or member UI.
triggers: [user, model]
---

# Hub invariants

Apply these on every change. They exist because real bugs shipped when they were broken.

## Authority — one store, deny never widen

- `authority_records` is the ONLY source of constituency authority. `accounts.role` is a technical kind ('member') — never check it for permissions.
- Capabilities, Council seats, and team roles derive through `src/lib/authority.ts` → `deriveAuthority`. Never add a parallel role store, lookup, or account flag for access.
- Unmapped/unknown role strings are denied, never widened to a broader role. Do not add fallbacks that guess.
- Records count only while `status='active'` and inside `starts_at/ends_at`. Roles with `requiresCw` additionally need an active Constituency Work record — grant refuses when CW is lapsed.
- Every authority write goes through `withAuthorityLock` (src/lib/authorityLock.ts). Lock order is always: advisory locks on every written account (ascending id, deduplicated) → row locks → writes. Never reorder or skip — this is the deadlock contract.

## Data and content

- The repository carries NO operational data. Never hardcode real or fictional emails, names, accounts, policy text, or content in source — records live in the database; test data is provisioned (tests provision their own).
- Migrations are structure only — never data.
- Staff-editable vocabulary (labels, option lists, policy versions) lives in `content-documents`, fetched via `useDocument`/the documents endpoint — not in constants.

## API surface

- Members act through domain endpoints (`src/endpoints/*`), which authorise the actor then write via the Local API with `overrideAccess: true`. Generated REST/GraphQL writes stay staff-only — never open them to members.
- Every authority/workflow transition writes an audit entry with actor, action, target, reason.
- Free-text input goes through `cleanText` (strips markup to a fixpoint). Field validation is zod.
- Never log or return credentials, sessions, guardian/minority data, or personal contact fields. Member-facing payloads use `publicAccount`/`accountRef` shapes.

## MCP (`mcp-content/`)

- The MCP is a separate process. It signs in as a normal Hub account and writes through the live HTTP API — NEVER give it `DATABASE_URL`.
- `src/shared/` loads under plain `node` — `.js` only, no `process.env`, no Node-only APIs.

## Conventions

- British English in docs, UI copy, and comments.
- No AI-generated imagery.
- Comments: concise — state the invariant or rationale, do not narrate the code.

## Session memory

Use the `memory` MCP server (bank `youngo-hub`): `recall` tagged `project:youngo-hub` before substantive work, `retain` verified findings and decisions after. No local vault files. Never retain secrets or member data.
