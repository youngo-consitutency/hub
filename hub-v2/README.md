# Hub v2

This is the separate Next.js and Payload version of YOUNGO Hub. Payload manages content and accounts; PostgreSQL stores the data. The member interface lives in `spa/`, and the staff content console is at `/console`.

The root Railway configuration and root test command do not run this app. Its presence here does not confirm which version serves the live website.

## Local setup

Use Node.js 22.13 or later in the Node 22 series and a separate local PostgreSQL database. From this directory:

```sh
npm ci
export DATABASE_URL='postgres://localhost:5432/youngo_v2_dev'
export PAYLOAD_SECRET="$(openssl rand -hex 32)"
npm run migrate
npm run dev
```

Create `youngo_v2_dev` first and adjust the connection string to your local database account. Open <http://localhost:3000>. Keep the secret stable between local sessions if you want existing sessions to remain valid. Never commit it.

Use the migrations in `src/db/migrations/`. Do not apply the root application’s SQL migrations to this database.

## Checks

```sh
npm run lint
npm run build
npm run test:int
npm run test:e2e
```

The integration tests run in Node and expect a running server with seeded demo accounts. Browser tests start the app with `npm run dev`. Both use npm; pnpm is not required.

`npm run seed` reads files from the root `data/` directory and creates demo accounts with known passwords. Some input files are not included in a public clone. Use it only with a disposable local database; it is not a production setup command.

## Deployment limits

The checked-in Dockerfile expects Next.js standalone output, but `next.config.ts` does not enable it. The Compose file still contains a MongoDB starter setup, while this app uses PostgreSQL. Neither is a verified deployment recipe.

Read the [code map](https://github.com/youngo-consitutency/hub/wiki/Code-map), [project status](https://github.com/youngo-consitutency/hub/wiki/Project-status), and [contribution guide](../CONTRIBUTING.md). Changes to the copied interface in `spa/` may also need changes in root `src/`; explain this in your pull request.

## Dependencies

A scoped override updates the old esbuild copy used by `@esbuild-kit/core-utils` through Drizzle Kit. Remove the override once that dependency chain includes a patched version.
