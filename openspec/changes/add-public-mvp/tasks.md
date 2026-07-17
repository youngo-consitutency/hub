# Tasks — add-public-mvp

## 1. Foundations (Phase 0)
- [x] 1.1 Repo scaffold: package.json, vite, eslint, gitignore, README, dir layout
- [x] 1.2 `src/styles/tokens.css` — Verdant tokens verbatim from 02 §2.5, both themes
- [x] 1.3 Component library: Button, Chip (status map), CountdownChip, Section,
      Skeleton, EmptyState, cards (Event, Submission, Decision, COY, WG)
- [x] 1.4 App shell: desktop sidebar + mobile bottom tabs + More sheet, theme toggle
- [x] 1.5 `/gallery` component gallery page (Phase 0 gate: renders both themes)
- [x] 1.6 `migrations/001_init.sql` — full DDL from 04 §2
- [x] 1.7 Railway staging + production environments, deploy, `/healthz` green
      — project `youngo-hub`; staging deployed (fixture mode) at
      https://web-staging-31ab.up.railway.app, `/healthz` green. `production` env
      exists; its deploy waits on a `v*` tag / manual promote per 05 §2.

## 2. Backend (fixture mode)
- [x] 2.1 Express server: `/healthz`, static dist serving, port 8787
- [x] 2.2 `server/lib/store.js` fixture store with relative-date materialization
- [x] 2.3 `server/lib/feed.js` pure feed assembly + tests
- [x] 2.4 Public endpoints: feed, events, submissions, council, coys, groups,
      directory (roles-only), search
- [~] 2.5 Postgres wiring behind store interface (`DATABASE_URL` branch) + seed script
      from fixtures — DONE: Railway Postgres provisioned (staging), `server/lib/db.js`
      pool, migration runner (`npm run migrate`) as Railway pre-deploy hook, full schema
      (001) + `gys_signups` (002) applied, and the GYS signup write-path persists to
      Postgres (verified durable across redeploy). DEFERRED: routing the read getters
      (events/submissions/…) to Postgres + a fixtures→DB seed — staging intentionally
      stays on relative-date fixtures for the always-live demo (05 §2); real content
      lands with the 5.x sprint.

## 3. Member views (Phase 1)
- [x] 3.1 Home: live banner, pinned, this week, closing soon (submissions + DMP mixed),
      COY strip, find-your-WG grid
- [x] 3.2 Calendar: agenda grouped by day, type filter pills, dual-time lines
- [x] 3.3 Submissions: Open / Archive segmented views
- [x] 3.4 Council: In progress / Decided views with window countdowns
- [x] 3.5 COY tracker: type + region filters, status-priority sort
- [x] 3.6 Working groups index with join links
- [x] 3.7 Directory (roles + generic emails, no personal handles)
- [x] 3.8 Search page (grouped results across all content)
- [x] 3.9 Detail pages: event, submission, decision (incl. public status timeline),
      COY, WG page with join strip
- [x] 3.10 Command palette (Ctrl-K) wrapping the search endpoint
- [x] 3.11 Loading skeletons audit + empty/error states on every section (base states
      exist; audit against 03 per-screen specs)

## 4. Quality gates
- [x] 4.1 `node --test`: time formatting/countdown thresholds, feed assembly
- [x] 4.2 eslint clean
- [ ] 4.3 Lighthouse pass on staging ≤200KB gz initial JS, LCP ≤2.5s (needs deploy)
- [ ] 4.4 Both-themes screenshot on PR (convention from 05 §11)

## 5. Content
- [ ] 5.1 Replace fixtures with real seed content (content sprint with WG admins)
- [ ] 5.2 Recruit 1–2 real WG admins for the admin-panel change's live test

## Follow-up changes (specified in canonical docs)
add-ics-feeds ✅ (see openspec/changes/add-ics-feeds) · add-share-cards · add-admin-panel ·
add-coy-intake · add-pwa-shell · add-members-auth (P2) · add-session-mode (P2) ·
add-ai-assist (P3)
