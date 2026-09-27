# YOUNGO Hub agent guidance

YOUNGO Hub is the current YOUNGO member and mission-control product — one Next.js + Payload application: the member interface lives in `spa/`, the staff content console is at `/console`, and PostgreSQL holds the data. `YMC-v2` is superseded historical context; do not add new features there.

## Hub Intelligence invariants

- Public adapter: `POST /api/intelligence/public/query`.
- Authenticated adapter/UI: `POST /api/intelligence/query` and `/intelligence`.
- Authorisation is source-side and derived in `src/lib/access.ts`.
- Never index or return credentials, sessions, private messages, raw account records, guardian data, minority data, or personal account email/phone fields.
- Ordinary members receive public evidence plus only their own role/assignment context.
- Contact-channel evidence requires `intelligence.contacts.read`.
- Every synthesis claim must retain citations and a verification caveat.
- Semantic retrieval remains shadow/opt-in until the governed benchmark passes human review and non-regression.
- The only writeback through the Intelligence adapters is `save_research_note`; it requires citations, idempotency, independent admin approval, and separate application.
- Intelligence query responses are read-only. Authorised negotiation agents may use separate scoped proposal APIs to create or revise unpublished review candidates grounded in query evidence. They may not directly change canonical records, approve, endorse, publish, transmit submissions, or send messages.
- Record private queries and every writeback transition in the audit trail.
- Store unauthenticated public queries as fingerprints only; never persist their raw text.
- Routine deploys must never print reset URLs. `PRINT_ADMIN_RESET_URLS` is emergency opt-in and applies only to a newly created bootstrap admin.

## Agent content MCP

Agents add Hub information (opportunities, resources, events, announcements)
through `scripts/agent/hub-content-mcp.mjs` (stdio) or `mcp-content/server.mjs`
(Railway HTTP) using a Hub account (`HUB_EMAIL` / `HUB_PASSWORD` or
`HUB_TOKEN`). Writes go to the live HTTP API, so review queues and the audit
trail still apply. Live events/announcements can be loaded with `get_content`
and patched with `update_content` (draft pipeline or apply-now). Never give
that MCP `DATABASE_URL`. The HTTP service is a separate Railway service with
`MCP_TOKEN`; do not mount it on the Hub web process. See the [Agent tools guide](https://github.com/youngo-consitutency/hub/wiki/Agent-tools).

## Negotiation agent proposals

The design direction is agents that prepare actionable proposals for human review. Existing negotiation code does not establish that every agent-proposal requirement below is implemented or deployed.

The former OpenSpec handoff and contracts are not included in this public checkout. Use the [project status](https://github.com/youngo-consitutency/hub/wiki/Project-status) and current code to establish what exists. Ask maintainers for the governing requirements before extending agent proposal permissions. Do not mark planned functionality as deployed.

- Scoped, revocable task grants may authorise agents to propose track/call updates, position cards, submission drafts, and paragraph amendments, including scheduled work without approval for every run.
- Proposal writes require citations, verification caveats, immutable source/target versions, idempotency, agent and task provenance, and an audit trail. Agents may revise only their own unreviewed candidates; never overwrite human edits.
- An authorised human independently reviews the exact candidate version before a separate application step changes canonical records. Stale targets or revised candidates invalidate approval. Only the reviewed patch may be applied; application cannot regenerate content.
- Editorial approval, constituency endorsement, and external transmission are distinct. Agents cannot grant any of them. Research-note approval remains the existing independent-admin process.
- Derive scope in `src/lib/access.ts`; do not reuse broad content apply-now capabilities or give agents database credentials. Restricted project material requires an explicit project-scoped grant and remains outside ordinary Intelligence retrieval.

## Verification

Run `npm run lint` and `npm run build`. `npm run test:int` and `npm run test:e2e` need a running server with a seeded PostgreSQL database. Deployment targets the Railway `youngo-hub` service explicitly and should go to staging before production.

The historical Intelligence proposal is not included in this public checkout; preserve the invariants above and verify behaviour against source and tests.

## Documentation and contributions

Keep the README and contributor guides concise. Longer guides live in the [GitHub wiki](https://github.com/youngo-consitutency/hub/wiki). Do not add local agent notes, private records, or review output to the repository. Follow CONTRIBUTING.md and submit future changes through pull requests.

Use British English for documentation, interface copy, comments, and review text. Preserve API names, identifiers, official titles, and quotations.
