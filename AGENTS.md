# YOUNGO Hub agent guidance

YOUNGO Hub is the current YOUNGO member and mission-control product. `YMC-v2` is superseded historical context; do not add new features there.

## Hub Intelligence invariants

- Public adapter: `POST /api/intelligence/public/query`.
- Authenticated adapter/UI: `POST /api/intelligence/query` and `/intelligence`.
- Authorization is source-side and derived in `server/lib/access.js`.
- Never index or return credentials, sessions, private messages, raw account records, guardian data, minority data, or personal account email/phone fields.
- Ordinary members receive public evidence plus only their own role/assignment context.
- Contact-channel evidence requires `intelligence.contacts.read`.
- Every synthesis claim must retain citations and a verification caveat.
- Semantic retrieval remains shadow/opt-in until the governed benchmark passes human review and non-regression.
- The only writeback is `save_research_note`; it requires citations, idempotency, independent admin approval, and separate application.
- Never turn a query response directly into a governance, membership, event, submission, or message mutation.
- Record private queries and every writeback transition in the audit trail.
- Store unauthenticated public queries as fingerprints only; never persist their raw text.
- Routine deploys must never print reset URLs. `PRINT_ADMIN_RESET_URLS` is emergency opt-in and applies only to a newly created bootstrap admin.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. Deployment targets the Railway `youngo-hub` service explicitly and should go to staging before production.

See `openspec/changes/add-intelligence-workspace/` for the governing proposal, design, tasks, and scenarios.
