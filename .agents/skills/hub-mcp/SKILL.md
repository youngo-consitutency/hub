---
name: hub-mcp
description: Changing the content MCP service — its isolation contract and the shared-module constraint.
triggers: [user, model]
---

# Content MCP

`mcp-content/` is an independent service — never part of the web process, never with database access.

## The contract

- It signs in as a normal Hub account (`HUB_EMAIL`/`HUB_PASSWORD` or `HUB_TOKEN`) and writes through the live HTTP API (`HUB_ORIGIN`), so review queues and the audit trail apply unchanged.
- **Never pass `DATABASE_URL` to it.** If a tool "needs" the database, the tool is wrong — add an API endpoint instead.
- Auth on the HTTP service: `MCP_TOKEN` is required (the server refuses to start without it) and is accepted only as `Authorization: Bearer` (hono `bearerAuth`) — never in the URL. There is no anonymous mode. `POST /mcp` only — it's stateless.

## The .js constraint

- Everything it imports must load under plain `node`: `.mjs`/`.js` only. `src/shared/` exists for this — keep those files `.js`, no TypeScript syntax, no `process.env`, no Node-incompatible imports. Converting one to `.ts` breaks the service at runtime, not at build.
- `scripts/agent/hub-mcp.mjs` is the stdio wrapper — keep its interface stable. It also attaches the session-memory tools (`lib/memory.mjs`, `HINDSIGHT_API_KEY` gated) so local agents configure one `hub` server; the hosted HTTP service must NOT attach them — external consumers' memory would land in this project's bank.

## Verify

`scripts/ci/mcp-smoke.mjs` boots the server with the Hub API unreachable and completes the MCP handshake — it must pass; it proves no DB/API dependency at boot. Also run `node -e "import('./mcp-content/lib/mcpServer.mjs').then(m => console.log(Object.keys(m)))"`.
