# YOUNGO Hub content MCP (HTTP)

Streamable HTTP MCP so Grok Build on a phone can add Hub information. It signs
in as a Hub account and calls `https://youngohub.org` member APIs. It never
opens the database. It does not speak OAuth.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `MCP_ALLOW_ANONYMOUS` | no | `1` — Grok Connectors with no OAuth / no bearer |
| `MCP_TOKEN` | unless anonymous | Shared secret: Bearer, `?token=`, or `/t/<token>/mcp` |
| `HUB_ORIGIN` | no | Default `https://youngohub.org` |
| `HUB_EMAIL` / `HUB_PASSWORD` | one pair | Hub account |
| `HUB_TOKEN` | alternative | Existing Hub session |

Do not set `DATABASE_URL`.

## Local

```bash
MCP_ALLOW_ANONYMOUS=1 node server.mjs
```

Health: `GET /healthz`  
MCP: `POST /mcp`

Production: `https://youngo-hub-content-mcp-production.up.railway.app/mcp`
