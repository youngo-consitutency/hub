# YOUNGO Hub

YOUNGO’s membership and coordination platform: working groups, events, resources, submissions, and staff tools.

[Website](https://youngohub.com) · [Wiki](https://github.com/youngo-consitutency/hub/wiki) · [Contributing](CONTRIBUTING.md)

## Applications

- **Root:** React, Express, and PostgreSQL. The root Railway configuration deploys this app.
- **[hub-v2](hub-v2/README.md):** a separate Next.js and Payload application with its own database and tests.
- **[mcp-content](mcp-content/README.md):** assistant tools that use the Hub’s API and account permissions.

## Development

Use Node.js 22.13 or later in the Node 22 series.

```sh
git clone https://github.com/youngo-consitutency/hub.git
cd hub
npm ci
npm run dev-all
```

Open <http://localhost:5173>. Express runs on port `8787`. Without PostgreSQL, the root app uses public fixtures and local JSON files. See [database setup](https://github.com/youngo-consitutency/hub/wiki/Local-development#database) for database-backed features.

```sh
npm run check
```

This runs the root content, formatting, lint, type, test, and build checks. Hub v2 has separate checks.

## Licence

[GPL-3.0](LICENSE). Third-party notices still apply. The `hub-v2` package’s MIT label remains unresolved.
