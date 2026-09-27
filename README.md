# YOUNGO Hub

YOUNGO’s membership and coordination platform: working groups, events, resources, submissions, and staff tools.

[Website](https://youngohub.com) · [Wiki](https://github.com/youngo-consitutency/hub/wiki) · [Contributing](CONTRIBUTING.md)

## Application

One Next.js and Payload application, backed by PostgreSQL. The member interface is in `spa/`, the staff console is at `/console`, and server code is in `src/`.

[`mcp-content/`](mcp-content/README.md) is a separate service for assistant tools that use the Hub’s API and account permissions.

## Development

Use Node.js 22.13 or later in the Node 22 series, or Node 24, and a local PostgreSQL database.

```sh
git clone https://github.com/youngo-consitutency/hub.git
cd hub
npm ci
createdb youngo_dev
export DATABASE_URL='postgres://localhost:5432/youngo_dev'
export PAYLOAD_SECRET="$(openssl rand -hex 32)"
npm run migrate
npm run dev
```

Open <http://localhost:3000>. Keep `PAYLOAD_SECRET` stable between sessions and never commit it. The app requires PostgreSQL; it has no database-free fixture mode.

```sh
npm run check
```

This runs lint and the production build, including type checks. Integration and browser tests need a running server and a seeded database; the test suites provision their own accounts. For throwaway local logins and demo workflow content (proposals, elections, filings), `npm run seed:demo` requires `DEMO_EMAIL_DOMAIN` and `DEMO_PASSWORD` in the environment — use it only with a disposable database. Some seed inputs are not included in a public clone.

The Payload schema is separate from the former Express schema. Do not point its migrations at an existing member database without a verified migration and rollback plan. See [project status](https://github.com/youngo-consitutency/hub/wiki/Project-status) for remaining deployment requirements.

## Licence

[GPL-3.0](LICENSE). Third-party notices still apply. The package’s inherited MIT label remains unresolved.
