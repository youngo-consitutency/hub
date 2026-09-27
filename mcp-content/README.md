# Hub content service

This service lets an authorised assistant read and update Hub content through the same API used by the website. It uses a Hub account and keeps that account’s permissions and review requirements.

MCP is the connection format an assistant uses to call these tools. The full guide is in [Agent tools](https://github.com/youngo-consitutency/hub/wiki/Agent-tools).

## Run locally

Use Node.js 22 or later. Set `HUB_ORIGIN` to the Hub you intend to use and provide either `HUB_TOKEN` or `HUB_EMAIL` and `HUB_PASSWORD` through your environment. For the HTTP service, also set a strong `MCP_TOKEN`.

```sh
node server.mjs
```

The default port is `8080`. Health checks use `/healthz`; assistant requests use `/mcp` with `Authorization: Bearer <MCP_TOKEN>`.

For a local assistant that starts its own process, run `npm run mcp:content` from the repository root instead. It uses the same Hub account settings and does not need the HTTP service token.

## Deployment and access

Deploy this directory as a separate Railway service using its own `railway.json`. Set `HUB_ORIGIN` explicitly: the client has a default domain that may differ from the website you intend to use.

Never give this service `DATABASE_URL`. Keep `MCP_ALLOW_ANONYMOUS` unset; turning it on lets callers use the configured Hub account without authenticating to this service. Prefer the bearer header over token-bearing URLs, which can appear in history and logs.

Start with `whoami` to check the account’s access, then `catalog_options` for accepted field values. Some authorised updates can publish immediately, so read the tool description before making a write.
