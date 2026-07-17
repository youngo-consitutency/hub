# Design — add-public-mvp

Technical decisions for this change. Product/UX/API details live in the canonical
spec package (`../docs/specs/youngo/`); this file only records what's specific to
this implementation pass.

## Data layer: fixtures first, Postgres behind the same interface

`server/lib/store.js` exposes read functions (`getFeed`, `listEvents`, `listGroups`, …).
For this change it materializes `data/fixtures.json` at boot; fixture dates are stored
as **relative offsets** (`dayOffset`, `hourUtc`, `deadlineInDays`, `startOffsetMin`) so
the demo always has "this week" content, a live meeting, and countdown chips in every
urgency band. When `DATABASE_URL` is set, the same functions will query Postgres
(migration `001_init.sql` ships now, wiring is a task in `add-admin-panel` — content
writes are what first require a real DB).

## Feed assembly is pure

`server/lib/feed.js` (`assembleFeed(data, now)`) sorts and slices the home payload —
live event, pinned announcements, this-week events, closing-soon (submissions + DMP
windows mixed, per product spec), COYs. Pure function, `node --test` covered.

## Client conventions

- Path-based routing (`src/lib/router.js`: `usePath()` + `navigate()`, popstate-aware,
  `<A>` link component) — no router dependency, per GYC convention.
- `src/lib/time.js` implements the canonical dual-time format and countdown thresholds;
  it takes explicit `tz`/`now` params so tests are deterministic.
- Theme: `data-theme` on `<html>`, default **dark** (brand mode), toggle persisted to
  localStorage. Tokens map both modes; components never hardcode hex.
- Each page fetches independently and renders its own skeleton / empty / error-retry
  states (03 §13: one failed section never blanks a page).

## Trimmed out of this change deliberately

zod (arrives with the first write endpoint), pg wiring, rrule expansion (calendar
shows one-off fixture events until `add-admin-panel` introduces recurring event
authoring), ICS/OG endpoints, service worker. Each is a named follow-up change in
proposal.md so nothing silently disappears.
