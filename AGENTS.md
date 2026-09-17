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
- The only writeback through the Intelligence adapters is `save_research_note`; it requires citations, idempotency, independent admin approval, and separate application.
- Intelligence query responses are read-only. Authorized negotiation agents may use separate scoped proposal APIs to create or revise unpublished review candidates grounded in query evidence. They may not directly change canonical records, approve, endorse, publish, transmit submissions, or send messages.
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
`MCP_TOKEN`; do not mount it on the Hub web process. See `docs/AGENT_CONTENT.md`.

## Negotiation agent proposals

The approved design direction is agents that prepare actionable proposals for human review, as described in `openspec/changes/add-negotiation-workspace/`. These capabilities are planned, not implemented by this guidance.

For implementation, start with `openspec/changes/add-negotiation-workspace/DEVELOPER_HANDOFF.md`, follow its S0–S6 sequence, and verify the normative requirements in `specs/` and `contracts.md`. Record completion evidence against requirement IDs; do not mark planned functionality as deployed.

- Scoped, revocable task grants may authorize agents to propose track/call updates, position cards, submission drafts, and paragraph amendments, including scheduled work without approval for every run.
- Proposal writes require citations, verification caveats, immutable source/target versions, idempotency, agent and task provenance, and an audit trail. Agents may revise only their own unreviewed candidates; never overwrite human edits.
- An authorized human independently reviews the exact candidate version before a separate application step changes canonical records. Stale targets or revised candidates invalidate approval. Only the reviewed patch may be applied; application cannot regenerate content.
- Editorial approval, constituency endorsement, and external transmission are distinct. Agents cannot grant any of them. Research-note approval remains the existing independent-admin process.
- Derive scope in `server/lib/access.js`; do not reuse broad content apply-now capabilities or give agents database credentials. Restricted project material requires an explicit project-scoped grant and remains outside ordinary Intelligence retrieval.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. Deployment targets the Railway `youngo-hub` service explicitly and should go to staging before production.

See `openspec/changes/add-intelligence-workspace/` for the governing proposal, design, tasks, and scenarios.
