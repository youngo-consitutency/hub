# YOUNGO Hub

YOUNGO Hub is a member portal for the Children and Youth Constituency of the
UNFCCC. It puts the calendar, working groups, submissions, Council decisions,
COYs, contacts, onboarding, and organisation tools behind one account.

This repository is an active prototype. Authentication and member workflows are
implemented, while most calendar and public-content records still come from
`data/fixtures.json`.

## Run it locally

Requirements:

- Node.js `^20.19` or `>=22.12`
- npm

Install dependencies and start the API and Vite together:

```bash
npm install
npm run dev-all
```

Open <http://localhost:5173>.

The local API runs on port `8787` and Vite proxies `/api` and `/ics` requests to
it. PostgreSQL is optional for local development. Without `DATABASE_URL`,
accounts and sessions are written to ignored JSON files under `data/`.

On the first visit, acknowledge the Membership Policy, create an account, and
complete the membership course to unlock member pages.

### Useful commands

```bash
npm test
npm run lint
npm run build
npm run screenshots
```

To serve a completed build from Express:

```bash
npm run build
npm start
```

Then open <http://localhost:8787>.

Do not set `NODE_ENV=production` for the fixture-backed local setup. Production
mode requires both `DATABASE_URL` and `APP_ORIGIN`.

## Implemented

- Membership Policy acknowledgement
- Individual and organisation registration
- Email/password sessions and password reset
- Membership course and account verification
- Member feed, calendar, search, submissions, Council, COYs, and directory
- Working-group onboarding and scoped Contact Point management
- Organisation requests and viewer/representative/owner seats
- Administrator account review and reset-link generation
- Anonymous/member response filtering for private meeting and channel links
- System-aware light and dark themes with a saved manual override
- Desktop and mobile navigation

## Access model

| Access | Scope |
| --- | --- |
| Verified member | General member pages and private member fields |
| WG contact or lead | Only the working groups assigned to that account |
| NGO viewer | Read organisation requests and seats |
| NGO representative | Read and update organisation requests |
| NGO owner | Manage requests and organisation seats |
| Platform administrator | Account administration and explicit scope override |

Registration does not grant administrator or NGO-owner access. Platform
administrators are promoted with an explicit operator command, and organisation
owner access requires administrator approval.

## Project structure

```text
src/
  components/       shared React components and account gates
  content/          Membership Policy, course, and WG onboarding copy
  lib/              API, session, routing, and time helpers
  pages/            member and administration pages
  styles/           shared tokens and component styles
server/
  lib/              persistence, authorization, tokens, and response views
  routes/           public, auth, member, and ICS endpoints
migrations/         forward-only PostgreSQL migrations
data/fixtures.json  current demo content
scripts/            migration, admin bootstrap, and screenshot commands
tests/              Node test suite
```

The client is React 19 with Vite. The server is Express. The production store is
PostgreSQL; local development currently has JSON fallbacks for accounts,
sessions, WG state, NGO state, and reset tokens.

## PostgreSQL setup

Set the connection string and apply migrations:

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/youngo
npm run migrate
```

To promote an existing verified account:

```bash
export ADMIN_EMAILS=admin@example.org
npm run bootstrap-admin
```

The bootstrap command never creates an account and has no default email.

## Environment variables

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; required in production |
| `APP_ORIGIN` | Public HTTPS origin; required in production |
| `ADMIN_EMAILS` | Existing verified accounts accepted by `bootstrap-admin` |
| `LOG_PASSWORD_RESET_LINKS` | Print reset links only during explicit local development |
| `PORT` | Express port; defaults to `8787` |

## Security notes

- Passwords use asynchronous scrypt with per-account salts.
- Sessions and invitation/reset tokens use random bearer secrets.
- Reset and invitation secrets are hashed at rest and expire.
- Password reset invalidates all sessions for the account.
- WG and organisation permissions are enforced by the server, not the UI.
- Anonymous responses omit private meeting, channel, Drive, and contact fields.
- Public write and authentication routes have bounded per-IP rate limits.

Run both dependency checks before deployment:

```bash
npm audit
npm audit --omit=dev
```

## Known gaps

- Public content is still fixture-backed; the PostgreSQL content tables are not
  connected to an editor or publishing workflow.
- Local JSON persistence is duplicated across several server modules.
- Reset and invitation links need an owned email-delivery path.
- Registration collects too much information before members reach the hub.
- PostgreSQL migration and authorization paths need live integration tests.
- One account currently uses its most recently accepted active organisation
  seat when several exist.

These should be addressed before treating the project as a production member
system.

## Deployment

Railway configuration lives in `railway.toml`. Migrations must run before the
new server process starts.

```bash
railway up --environment staging --service web
```

Staging: <https://web-staging-31ab.up.railway.app>

## Contributing

Keep shared colors and spacing in `src/styles/tokens.css`, and reusable UI rules
in `src/styles/app.css`. Prefer existing components in `src/components/ui.jsx`
before adding page-specific wrappers.

Before opening a pull request:

```bash
npm test
npm run lint
npm run build
```
