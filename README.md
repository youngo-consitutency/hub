# YOUNGO Hub

A web app for YOUNGO members. The aim is to keep the things people regularly
need—events, working groups, submissions, contacts, onboarding, and internal
work—in one place.

## Current status

This is a working prototype, not a finished production system.

Accounts, sign-in, the membership course, role-based access, working-group
tools, organisation seats, messaging, and admin tools are implemented. Most
public content still comes from `data/fixtures.json`, and reset or invitation
emails are not sent automatically yet.

## Run it locally

You need Node.js `^20.19` or `>=22.12` and npm.

```bash
npm install
npm run dev-all
```

Open <http://localhost:5173>.

This starts:

- the Vite frontend on port `5173`
- the Express API on port `8787`

Vite forwards `/api` and `/ics` requests to the API.

PostgreSQL is optional for local development. If `DATABASE_URL` is not set, the
app uses ignored JSON files in `data/` for local accounts and workflow state.

On your first visit, accept the Membership Policy, create an account, and finish
the membership course.

### Run the built app

```bash
npm run build
npm start
```

Then open <http://localhost:8787>.

Do not set `NODE_ENV=production` for the JSON-backed local setup. Production
mode requires both `DATABASE_URL` and `APP_ORIGIN`.

## Useful commands

```bash
npm run dev-all       # frontend and API
npm test              # tests
npm run lint          # lint the code
npm run build         # build the frontend
npm run check         # lint, test, and build
npm run migrate       # apply database migrations
npm run screenshots   # refresh README screenshots
```

Run `npm run check` before opening a pull request. CI runs the same checks on
Node 20 and Node 22. It also tests the migrations against a clean PostgreSQL 16
database.

## What is in the app

- member feed, calendar, search, submissions, Council decisions, and COYs
- directory and role-based member messaging
- membership policy, registration, course, and verification flow
- working-group onboarding and Contact Point tools
- Focal Point, Membership Team, and GYS Policy Team workspaces
- organisation requests, seats, contribution points, and recognition
- admin account review, roles, audit log, and reset links
- Hub Intelligence search with citations and reviewed note writeback
- installable PWA and optional push notifications
- light and dark themes, using the device setting by default

Access checks live in the API. Hiding a page or button in React is not treated
as permission.

## PostgreSQL

Set a connection string, then run the migrations:

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/youngo
npm run migrate
```

The migration files are in `migrations/` and are applied in filename order.

## Create an admin

First create and verify the account through the app. Then run:

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/youngo
export ADMIN_EMAILS=admin@example.org
npm run bootstrap-admin
```

The command only promotes existing verified accounts. It does not create an
account, reset a password, or use a default email address.

## Environment variables

| Variable | What it is for |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; required in production |
| `APP_ORIGIN` | Public HTTPS URL; required in production |
| `ADMIN_EMAILS` | Accounts that `bootstrap-admin` may promote |
| `LOG_PASSWORD_RESET_LINKS` | Print reset links during explicit local development |
| `PORT` | API port; defaults to `8787` |
| `VAPID_PUBLIC_KEY` | Web Push public key used by the server |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_SUBJECT` | Web Push contact URI, for example `mailto:ops@example.org` |
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key included in the frontend build |

Push notifications are optional. Generate VAPID keys with:

```bash
node scripts/generate-vapid-keys.mjs
```

## Project layout

```text
src/                 React frontend
server/              Express API
migrations/          PostgreSQL migrations
data/fixtures.json   Demo public content
scripts/             Setup and maintenance scripts
tests/               Node test suite
openspec/            Product change notes
```

Shared colours and spacing belong in `src/styles/tokens.css`. Reusable UI rules
belong in `src/styles/app.css`. Check `src/components/ui.jsx` before adding
another page-specific component.

## Security checks

Before a deployment:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
```

Passwords use scrypt. Session, invitation, and reset tokens are random and
stored as hashes. A password reset ends all existing sessions for that account.
Anonymous API responses leave out private meeting, channel, Drive, and contact
details.

## Known limitations

- Most public content is still fixture-backed.
- There is no editor or publishing workflow for that content.
- Reset and invitation links still need a real email service.
- Registration asks for more information than it should.
- PostgreSQL permission checks and simultaneous invite acceptance need more
  integration tests.
- An account with several active organisation seats currently uses the most
  recently accepted seat.
- The onboarding flow still needs final alignment with the YOUNGO Onboarding
  Taskforce.

## Deployment

Railway settings are in `railway.json`. Railway runs `npm run migrate` before
starting a new server process.

```bash
railway up --environment staging --service web
```

Staging: <https://web-staging-31ab.up.railway.app>
