# YOUNGO Hub

A shared space for YOUNGO members to find groups, attend events, share resources and work on proposals, decisions and elections.

## What is here

- Public information about YOUNGO, its working groups, youth conferences and resources.
- Member accounts, induction, group workspaces, opportunities and policy contributions.
- Decision-making processes, voting, elections and operational requests, with access based on membership and assigned responsibilities.
- Review tools for membership and content teams. There is no general admin UI. The one exception is the content console at `/cms` (Payload admin), open only to accounts holding `content.publish` and limited to editing page content; every other staff operation runs through the Payload local API (terminal scripts) or direct database access.

The resource collection is part of the Hub. Existing source credits and review records remain attached to imported material.

## How it is built

React draws the member interface in `src/member/`, routed through the Next.js App Router. Next.js runs the website and server. Payload manages accounts, content and access checks. Its admin panel is mounted only as the content console at `/cms`; other staff work happens through terminal scripts (`payload` local API) or the database. The [Architecture](https://github.com/youngo-consitutency/hub/wiki/Architecture) wiki page explains the request path, the authority model and the scheduled jobs. PostgreSQL stores the records. Server code and access checks are in `src/`.

The separate [content service](https://github.com/youngo-consitutency/hub/wiki/Agent-tools) lets authorised assistant tools use the Hub’s API. It does not receive database credentials.

## Run locally

Use Node.js 22.23.4 or later in the Node 22 series, or Node 24.22.1 or later (the `engines` range in `package.json`; `.nvmrc` pins 22.23), and PostgreSQL.

```sh
git clone https://github.com/youngo-consitutency/hub.git
cd hub
npm ci
docker run -d --name youngo-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=youngo_dev -p 127.0.0.1:5433:5432 postgres:16
export DATABASE_URL='postgres://postgres:postgres@localhost:5433/youngo_dev'
export PAYLOAD_SECRET="$(openssl rand -hex 32)"
npm run migrate
npm run dev
```

The container publishes Postgres on 127.0.0.1 only, and `postgres` is a throwaway local-only password: never reuse it, and never publish the port on a shared network. `docker-compose.yml` does the same but requires you to export `POSTGRES_PASSWORD` first.

Open <http://localhost:3000>. Keep `PAYLOAD_SECRET` stable between sessions and private. Use a separate development database; do not run migrations against an existing member database without a tested migration plan.

```sh
npm run check       # token contrast, AnyValue ratchet, unit tests, lint, production build
npm run test:unit   # needs nothing running
npm test            # integration + browser tests
```

`check` includes type checks via the production build. Integration and browser tests need a running server and a disposable database; they create their own accounts and refuse any database not named `*_test`, `*_ci`, `*_smoke`, `*_design` or `*_scratch` (set `ALLOW_TEST_DB=1` only if you are certain it holds no real data). Start the server with `HUB_DISABLE_RATE_LIMIT=1` or login-heavy specs will get 429. Set `TEST_BASE_URL` to use a different local port. See [local development](https://github.com/youngo-consitutency/hub/wiki/Local-development).

Optional environment variables:

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` — error tracking (server and browser). Events are scrubbed of credentials and member-identifying fields before leaving the process.
- `CRON_SECRET` — bearer token for the two scheduled jobs in `vercel.json`: `GET /api/cron/notifications-drain` (notification-queue backstop and guardian-enquiry retention) and `GET /api/cron/decisions-sweep` (closes decision windows). Vercel sends the secret automatically.
- `SMTP_URL` or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` + `EMAIL_FROM` — outbound email; broadcasts are queued in `notification_outbox` and delivered asynchronously with retries.
- `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` — web push delivery.

## Design and accessibility

Colours, radii and spacing are design tokens in `design/tokens/` (editable in Figma) and are generated into CSS with `npm run design:build`; `npm run design:check` fails the build on any colour pair below WCAG 2.2 AA. How the system works, the Figma workflow, and how to run the accessibility audits against a local disposable database are in the wiki: [Architecture](https://github.com/youngo-consitutency/hub/wiki/Architecture), [Design system](https://github.com/youngo-consitutency/hub/wiki/Design-system), [Accessibility audits and local data](https://github.com/youngo-consitutency/hub/wiki/Accessibility-audits-and-local-data).

## Deployments

Production runs on the `youngo-hub` Vercel project at [youngo-hub.vercel.app](https://youngo-hub.vercel.app). A production build applies pending migrations before building (`scripts/ci/vercel-build.mjs`), and a failed migration stops the deploy. Pull requests get Vercel previews backed by a separate preview database. Previews never send email or push and are kept out of search results; set `HUB_DELIVERY_DISABLED=true` to switch delivery off on any other deployment. The repository carries no data: content lives in the database.

## Licence

[GPL-3.0-only](LICENSE), matching the `license` field in `package.json`. Third-party notices still apply.
