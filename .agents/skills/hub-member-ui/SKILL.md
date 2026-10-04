---
name: hub-member-ui
description: Adding or changing a member page — App Router routes, gate chain, shared components, data access.
triggers: [user, model]
---

# Member UI

Member routes are real App Router paths under `src/app/(site)/(member)/`. Components and shared state live in `src/member/`.

## Adding a page

1. Write the component in `src/member/pages/<Name>.tsx` — `'use client'`, named export.
2. Add the wrapper `src/app/(site)/(member)/<path>/page.tsx`:

```tsx
'use client'
import { Name } from '../../../../member/pages/Name'
export default function Page() { return <Name /> }
```

Dynamic segments use `useParams<{ slug: string }>()` and pass `slug`/`extra` props — same prop names the components take.

## The gate chain (don't re-implement)

`(member)/layout.tsx` applies: `AccessGate` (public/auth surfaces) → `AccountProvider` → `MemberGate` → `Shell` → page.

- Route guards live ONLY in `lockedFor(path, account)` in `src/member/lib/guards.tsx`. To gate a new path, add the condition there — the API still enforces every permission regardless.
- Unverified members are limited to `PRE_VERIFY` paths — add to that list if the page should be reachable pre-course.
- Pages that render while signed out (negotiations) must handle `useAccount()` returning null.

## Conventions

- Navigation: the `A` component (not `<Link>`) — it preserves member-UI behaviour. Programmatic nav: `navigate()`/`replace()`/`usePath()` from `src/member/lib/router` (backed by `next/navigation`).
- Data: `apiGet`/`apiPost`/`apiPatch` in `lib/api`; SWR via `useDocument`/feature hooks; account context via `useAccount()`.
- Primitives: `PageHeader`, `Empty`, `Skeletons`, `Card`, `FilterPill`, `Async` — reuse them rather than new markup.
- Styles: extend the existing stylesheets in `src/member/styles/`; no inline CSS frameworks.
- Copy: British English, sentence case. No emoji unless requested.
