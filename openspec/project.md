# Project Context — YOUNGO Hub

## Purpose

Member-facing app for YOUNGO (the UNFCCC youth constituency): the single place members
check to answer six questions in under 30 seconds — what's happening, what can I
contribute to, where can I go, who do I contact, what's my working group doing, and
what's being decided. Aggregates signal from WhatsApp/mailing lists/Drive and points
back to those channels; it does not replace them.

**Canonical spec package** (source of truth, written 2026-07): `../docs/specs/youngo/`
- `01-product-spec.md` — functional requirements (OpenSpec format, phase-tagged P1/P2/P3)
- `02-design-system.md` — "Verdant" design language: tokens, type, components to the pixel
- `03-screens-ux.md` — routes, layouts, states, cross-screen rules
- `04-api-data-spec.md` — Postgres DDL, REST contract, auth matrix, jobs
- `05-infrastructure.md` — repo layout, Railway topology, CI, security, PWA budgets
Master handoff: `../docs/handoffs/youngo-app-plan-handoff.md`.

## Surfaces

- Member PWA: `/` home feed, `/calendar`, `/submissions`, `/council` (DMP decisions),
  `/coys`, `/groups`, `/directory`, `/search`, `/gallery` (component gallery, dev)
- Role-scoped operations: `/admin`, `/staff/content`, `/staff/points`, `/cp`,
  `/team/membership`, `/team/gys`, `/focal`, and `/ngo`. The shells and source-side
  capability checks exist; collection coverage still expands through OpenSpec changes.
- API: Express `/api/*`, ICS at `/ics/*`, OG share cards at `/og/*` (ICS/OG pending)

## Tech stack

- React 19 + Vite (no router library; path-based routing per GYC convention), plain CSS.
  Design tokens live ONLY in `src/styles/tokens.css` (Verdant, dark-first).
  Typography uses the operating system's native UI font stack to avoid font downloads and support older hardware. Icons: lucide-react.
- Express in `server/` (`/api/*`). Data layer: `server/lib/store.js` — Postgres via `pg`
  when `DATABASE_URL` is set, JSON fixture fallback (`data/fixtures.json`) otherwise
  (same pattern as the SB64 platform). Postgres DDL in `migrations/`.
- Pure logic in `server/lib/feed.js` and `src/lib/time.js`, covered by `node --test` in `tests/`.
- Deploy target: Railway (staging + production) per `05-infrastructure.md`.
- CRM and calendar-integration direction: `docs/CRM_SYSTEM_DESIGN.md`.

## Conventions

- Times: store UTC, display dual (`Wed 15 Jul · 13:00 UTC · 16:00 EAT`) via `src/lib/time.js`.
  Countdown thresholds: >7d neutral, ≤7d warn, ≤48h danger.
- Status chips and colors: only the pairs listed in `02-design-system.md` §6.2.
- English-only UI today; all copy will move to `src/locales/` before any second language.
- Tests: `npm test` (node --test). Lint: `npm run lint`. Dev: `npm run dev-all`.

## OpenSpec usage

- `openspec/specs/<capability>/spec.md` — what is deployed today (archive changes into here).
- `openspec/changes/<change-id>/` — proposal.md (why/what/impact), tasks.md (checklist),
  optional design.md, and `specs/<capability>/spec.md` deltas using
  `## ADDED|MODIFIED|REMOVED Requirements` with `#### Scenario:` blocks.
- Requirements here are trimmed to the change's scope; the full phase-tagged requirement
  set stays canonical in `../docs/specs/youngo/01-product-spec.md`.
