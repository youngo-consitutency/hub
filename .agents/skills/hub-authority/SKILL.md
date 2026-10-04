---
name: hub-authority
description: Working with the authority model — grants, revocations, capabilities, seats, the lock contract.
triggers: [user, model]
---

# Working with authority

`authority_records` is the single store for every scoped responsibility (mandate or participation). Everything else derives.

## Read path

- `deriveAuthority(records)` in `src/lib/authority.ts` → capabilities, `councilSeats`, `teamRoles`. `getAccessProfile(req, account)` in `src/lib/access.ts` is the memoised per-request entry point — use it, not ad-hoc record queries.
- `AUTHORITY_ROLES` is the controlled vocabulary — policy-cited per role. New roles get a registry entry first (scopeTypes, capabilities, `requiresCw`, `councilSeat` template), then grants.
- Legacy recorded strings resolve through the explicit map in authority.ts. Unmapped → denied and reported, never defaulted.

## Write path

- Grants/revocations go through `src/lib/authorityService.ts` (`grantAuthority`, `revokeAuthority`). They validate scope type, term window, CW where required, and audit — don't write `authority-records` directly from an endpoint.
- The partial unique index (account, role, scopeType, scopeId WHERE active) is the concurrency guard; re-recording refreshes term/evidence.
- `requiresCw` roles: refuse when the holder's CW is lapsed — the grant would be a no-op in derivation. Restore CW first.
- Substitutes: `council.substitute` grants additionally lock the PRINCIPAL's account — the covered seat lives in `councilSeat`, never in scope fields.

## The lock contract (src/lib/authorityLock.ts)

Every coordinated write acquires locks in this exact order:

1. advisory locks (`pg_advisory_xact_lock`, `AUTHORITY_LOCK_NS`) on EVERY account the transaction may write — ascending id, deduplicated, self-target = one key
2. row locks (FOR UPDATE / FOR SHARE / UPDATEs)
3. writes to `authority_records`

`withAuthorityLock(req, ids, fn)` performs step 1 for callers that don't manage a transaction. Composite flows (membership exits, admin team-role endpoints) call the tx-level helpers so lookup and write share one lock scope.

## Membership exits

End every active record for the scopes the exit covers — a record must not outlive its membership (S17). The sweep runs under the same advisory lock so a racing grant can't slip past.
