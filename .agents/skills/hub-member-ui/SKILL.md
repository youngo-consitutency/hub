---
name: hub-member-ui
description: Adding or changing a member page — App Router routes, gate chain, shared components, data access.
triggers: [user, model]
---

# Member UI

The Hub is one web app at `/hub`. Its pages live in the URL hash (`/hub#/calendar/some-event`), so the server only ever serves `/hub`. Code keeps writing plain app paths (`/calendar`, `/groups/x`); `src/member/lib/router.ts` turns them into hash routes inside the Hub and into real URLs elsewhere. Components and shared state live in `src/member/`. Site pages (`/`, `/about/*`, `/signin`, `/join`, `/privacy`, `/reset-password`) are real App Router routes under `src/app/(site)/(member)/`.

## Adding a page

1. Write the component in `src/member/pages/<Name>.tsx` — `'use client'`, named export.
2. Register it in `HUB_ROUTES` in `src/member/hub/routes.tsx`:

```tsx
page('/groups/:slug', from(() => import('../pages/GroupDetail'), 'GroupDetail')),
```

Put static paths before dynamic ones that would also match. `:params` arrive as props (`slug`, `extra`); a third argument passes fixed props. Retired paths use `redirect(from, to)`.

Old top-level URLs (`/calendar/x`) redirect to `/hub#/calendar/x` from `src/app/(site)/(member)/[...rest]/route.ts`, using `LEGACY_HUB_SEGMENTS` in `src/lib/hubUrl.ts`. Server-built links (emails, push) use `hubUrl('/path')` from the same file.

## The gate chain (don't re-implement)

`(member)/layout.tsx` applies: `AccessGate` (site surfaces outside `/hub`; sign-in in place inside it) → `AccountProvider` → `MemberGate` → `Shell` → `HubRoutes`.

- Route guards live ONLY in `lockedFor(path, account)` in `src/member/lib/guards.tsx`. To gate a new path, add the condition there — the API still enforces every permission regardless.
- Unverified members are limited to `PRE_VERIFY` paths — add to that list if the page should be reachable pre-course.
- Pages that render while signed out (negotiations) must handle `useAccount()` returning null.

## Conventions

- Navigation: the `A` component (not `<Link>`) — it preserves member-UI behaviour. Programmatic nav: `navigate()`/`replace()`/`usePath()` / `useQuery()` from `src/member/lib/router`. Never read `window.location` or `next/navigation` directly: inside `/hub` the path and query live in the hash. `/` means the Hub home inside the app and the public landing outside it.
- Data: `apiGet`/`apiPost`/`apiPatch` in `lib/api`; SWR via `useDocument`/feature hooks; account context via `useAccount()`.
- Primitives: `PageHeader`, `Empty`, `Skeletons`, `FilterPill`, `Async`, `Section`, `ErrorCard` from `src/member/components/ui.tsx` — reuse them rather than new markup. There is no `Card` component: cards are the `.card` class, and entity cards live in `src/member/components/cards.tsx`.
- Styles: extend the existing stylesheets in `src/member/styles/`; no inline CSS frameworks.
- Copy: British English, sentence case. No emoji unless requested.
