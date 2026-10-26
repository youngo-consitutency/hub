---
name: hub-endpoints
description: How to add or change a Hub API endpoint — context helpers, capability gates, error contract, audit.
triggers: [user, model]
---

# Adding or changing an endpoint

Endpoints live in `src/endpoints/<domain>.ts` and are registered in `src/payload.config.ts`. Read a neighbouring file first and follow its shape.

## The skeleton

```ts
{
  path: '/member/<domain>/<action>',
  method: 'post',
  handler: endpoint(async (req) => {
    const { account, access } = await memberContext(req)
    if (!hasCapability(access, 'domain.action')) throw fail.forbidden('…')
    const body = await readBody(req)
    // validate, act, audit — see below
    return Response.json({ ok: true })
  }),
}
```

## Rules

- **Wrap handlers in `endpoint()`** (src/lib/respond.ts) — it produces the `{ error: { code, message, fields? } }` contract and wires error tracking. Don't hand-roll try/catch for HTTP semantics.
- **Authorise via context helpers**, cheapest first: `requireAccount` (signed-in), `memberContext` (account + access profile), `verifiedContext` (course-verified), `requireCwMember` (decision rights), `requireAccountsManager`, `requirePlatformOperator`. Capability checks use `hasCapability(access, 'x.y')` — capabilities come from `src/lib/authority.ts` registry, never inline role strings.
- **Errors** come from `fail` — `fail.unauthorized`, `fail.forbidden`, `fail.notFound`, `fail.conflict(code, msg)`, `fail.validation(fields, msg)` for bad input; `new ApiError(status, code, msg)` for anything else (429, 409 with a custom code). Never `new Response({error…})` inline.
- **Input**: check fields by hand and report them through `fail.validation({ field: 'message' })` (zod is used only by `src/lib/registration.ts`), `cleanText(v, max)` for free text, `param(req, 'name')` for route params (missing → `''`; the handler decides status).
- **Writes** go through the Local API with `overrideAccess: true` AFTER the actor is authorised. Writes that must be atomic share a transaction or the authority lock — see src/lib/authorityLock.ts and copy its ordering.
- **Audit** every state transition: `await audit(req, account, { action: 'domain.action', targetType, targetId, reason?, before?, after? })`. Public/unauthenticated surfaces store fingerprints, never raw personal input.
- **Uniqueness under concurrency**: check-then-insert races — the DB unique index is the real guard; convert the violation to `fail.conflict` (see pg.ts `isUniqueViolation` and decisions.ts ballot handling).
- **Caching**: anonymous-safe reads may return `PUBLIC_CACHE` headers; member data gets no-store.

## Tests

Add a spec under `tests/int/<domain>.int.spec.ts`. Provision accounts with `provisionAccount()`; reach the app over HTTP — never seed fixtures into source.
