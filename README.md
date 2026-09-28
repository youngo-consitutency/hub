# YOUNGO Hub

A shared space for YOUNGO members to find groups, attend events, share resources and work on proposals, decisions and elections.

## What is here

- Public information about YOUNGO, its working groups, youth conferences and resources.
- Member accounts, induction, group workspaces, opportunities and policy contributions.
- Decision-making processes, voting, elections and operational requests, with access based on membership and assigned responsibilities.
- Review tools for membership and content teams, plus a separate staff console at `/console`.

The resource collection is part of the Hub. Existing source credits and review records remain attached to imported material.

## How it is built

React draws the member interface in `spa/`. Next.js runs the website and server. Payload manages accounts, content and the staff console. PostgreSQL stores the records. Server code and access checks are in `src/`.

The separate [content service](https://github.com/youngo-consitutency/hub/wiki/Agent-tools) lets authorised assistant tools use the Hub’s API. It does not receive database credentials.

## Run locally

Use Node.js 22.13 or later in the Node 22 series, or Node 24, and PostgreSQL.

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

Open <http://localhost:3000>. Keep `PAYLOAD_SECRET` stable between sessions and private. Use a separate development database; do not run migrations against an existing member database without a tested migration plan.

```sh
npm run check
npm test
```

`check` runs lint and a production build, including type checks. Tests need the matching database and server; they create their own accounts. Set `TEST_BASE_URL` to use a different local port. See [local development](https://github.com/youngo-consitutency/hub/wiki/Local-development).

Optional environment variables:

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` — error tracking (server and browser). Events are scrubbed of credentials and member-identifying fields before leaving the process.
- `CRON_SECRET` — bearer token for `GET /api/cron/notifications-drain`, the scheduled notification-queue backstop (wired in `vercel.json`; Vercel sends the secret automatically).
- `SMTP_URL` or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` + `EMAIL_FROM` — outbound email; broadcasts are queued in `notification_outbox` and delivered asynchronously with retries.
- `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` — web push delivery.

## Demo data

The [hosted demo](https://youngo-hub.vercel.app) uses the existing `youngo-hub` Vercel project and a separate database of fictional accounts and content. The interface always loads records through the normal API; there are no bundled fictional listings or sign-in shortcuts. See [demo environments](https://github.com/youngo-consitutency/hub/wiki/Demo-environments) for setup, delivery controls and account handling.

## Licence

[GPL-3.0](LICENSE). Third-party notices still apply. The package’s inherited MIT label remains unresolved.
