# YOUNGO Hub

YOUNGO Hub brings the day-to-day work of the UNFCCC youth constituency into
one web application. Members can find meetings, join working groups, follow
submissions, complete onboarding, contact the right people, and use the
workspaces attached to their responsibilities.

This repository contains the React frontend, Express API, PostgreSQL schema,
fixture data, tests, and Railway deployment configuration.

## Project status

The Hub is a working pre-production application. Registration, sign-in,
membership verification, role-based access, working-group tools, organisation
seats, administration, cited search, and the first governed content workflow are
implemented.

Events and announcements can be drafted, reviewed, and published in the Hub.
The remaining public directory, submission, Council, COY, and working-group
content still comes from `data/fixtures.json`. Password-reset and invitation
emails also need a delivery provider before production use.

## Start locally

Use Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm install
npm run dev-all
```

Open <http://localhost:5173>. This command starts:

- Vite on port `5173`
- the Express API on port `8787`
- a Vite proxy for `/api` and `/ics`

PostgreSQL is optional during local development. Without `DATABASE_URL`, the
server uses `data/fixtures.json` and ignored JSON files under `data/`.

To run the production build locally:

```bash
npm run build
npm start
```

The server prints the URL to open, normally <http://localhost:8787>.

Do not set `NODE_ENV=production` for the JSON-backed setup. Production mode
requires both `DATABASE_URL` and `APP_ORIGIN`.

## How the application is put together

```text
Browser
  └─ React routes and components in src/
       └─ /api and /ics requests
            └─ Express routes in server/routes/
                 ├─ PostgreSQL in production
                 └─ fixtures and ignored JSON files in local fixture mode
```

The frontend uses React, Vite, plain CSS, and Lucide icons. Pages are loaded
only when their route is opened, which keeps the initial download smaller for
members on slow connections or older devices.

The API owns authorization. React may hide controls that a member cannot use,
but every protected operation is checked again by the server. Access profiles
and capabilities are derived in `server/lib/access.js`.

Public fixture content is read through `server/lib/store.js`. Published event
and announcement revisions are layered over that content, so existing public
routes do not need to know whether an item came from a fixture or the editor.

## Content editing

There are two ways to update Hub content.

### Events and announcements

Verified staff with the `content_editor` responsibility can create and update
drafts in **Content Studio**. A different account with the
`content_publisher` responsibility reviews and publishes them.

The workflow is:

```text
draft → in review → approved → published
                  ↘ changes requested → draft
```

The author cannot approve or publish their own revision. Each transition is
recorded in the audit log. Admins assign the two responsibilities from the
account administration page.

### Other public content

Working groups, submissions, Council items, COYs, and directory contacts are
still maintained in `data/fixtures.json`. See
[`docs/EDITING_CONTENT.md`](docs/EDITING_CONTENT.md) for the supported fields
and validation command.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev-all` | Start Vite and the API |
| `npm run build` | Build the frontend into `dist/` |
| `npm start` | Serve the API and built frontend |
| `npm run content:check` | Validate fixture content |
| `npm run format` | Format source and configuration files |
| `npm run format:check` | Report files that need formatting |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Node test suite |
| `npm run check` | Validate content and formatting, then lint, test, and build |
| `npm run migrate` | Apply pending PostgreSQL migrations |
| `npm run bootstrap-admin` | Promote existing verified accounts listed in `ADMIN_EMAILS` |
| `npm run screenshots` | Refresh README screenshots |

Run `npm run check` before opening a pull request.

## Continuous integration

`.github/workflows/verify.yml` runs on pull requests and pushes to `main`.

For a push, the formatting job runs Prettier first. If it changes tracked
files, GitHub Actions commits the result to the same branch as
`github-actions[bot]`. The test jobs then check the formatted commit on Node 20
and Node 22 against PostgreSQL 16.

Pull requests from forks are read-only. CI checks their formatting but cannot
write back to the contributor's fork.

The workflow uses the repository's built-in `GITHUB_TOKEN`; it does not need a
personal access token.

## PostgreSQL

Set a connection string and apply the migrations:

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/youngo
npm run migrate
```

Migration files live in `migrations/` and run in filename order. The migration
runner records completed files, so running it again is safe.

### Create an admin

Create and verify the account through the Hub first. Then run:

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/youngo
export ADMIN_EMAILS=admin@example.org
npm run bootstrap-admin
```

The command only promotes existing verified accounts. It does not create an
account, change a password, or fall back to a default email address.

### Work as an admin

Sign in with a promoted account and open **Admin** in the **Staff** section, or
go directly to `/admin`.

The account list can be searched by name, email address, organisation, or
country. Use the filters to narrow it by account type, membership lifecycle, or
platform role. Results are sorted and paginated by the server, so the page does
not need to load every account at once.

Select **Manage** on an account before making a change. Every admin action
requires a clear reason of at least eight characters. The reason, acting
administrator, target account, previous value, new value, and request metadata
are written to the governance audit where applicable.

An administrator can:

- change the membership lifecycle;
- assign a platform role;
- assign or remove Membership Team, GYS Policy Team, content editor, and
  content publisher responsibilities;
- issue a one-time password-reset link;
- open the organisation points workspace for organisation accounts; and
- review the latest governance audit entries.

Membership lifecycle and access are connected:

- `registered` keeps the account at the course stage;
- `course_passed`, `awaiting_onboarding`, `active`, and `renewal_due` allow Hub
  access;
- ordinary members cannot be moved to `active` until they pass the membership
  course; and
- `expired` and `terminated` suspend Hub access and end every active session.

Platform roles and team responsibilities are different. Platform roles control
broad authority such as administrator, Focal Point, or organisation
administrator. Team responsibilities open a specific staff workspace. Give a
content contributor `content_editor` or `content_publisher`; do not give them
general administrator access. Working Group Contact Points are assigned from
the relevant working-group workspace, not from Admin.

An administrator cannot remove their own admin role or expire or terminate
their own account. Use a second administrator for those changes. A verified
organisation account is required before assigning the organisation
administrator role.

Password-reset links expire after one hour and work once. The Hub currently
shows the link once and can open a pre-addressed email draft, but it does not
send the message automatically. Deliver the link only to the account owner
through a trusted channel. The raw link is not stored in the audit record.

The **Governance audit** section shows the latest 30 entries. Use it to confirm
who made a sensitive change and when; do not treat it as a replacement for the
formal membership or governance records owned by the responsible team.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `APP_ORIGIN` | Production | Public HTTPS origin used for CORS and generated links |
| `ADMIN_EMAILS` | Admin setup | Comma-separated accounts that `bootstrap-admin` may promote |
| `PORT` | No | Express port; defaults to `8787` |
| `LOG_PASSWORD_RESET_LINKS` | Local only | Print reset links during an explicit local test |
| `VAPID_PUBLIC_KEY` | Push only | Web Push public key used by the server |
| `VAPID_PRIVATE_KEY` | Push only | Web Push private key |
| `VAPID_SUBJECT` | Push only | Web Push contact URI, such as `mailto:ops@example.org` |
| `VITE_VAPID_PUBLIC_KEY` | Push only | Public key included in the frontend build |

Push notifications are optional. Generate a VAPID key pair with:

```bash
npm run setup:push
```

## Repository map

```text
.github/workflows/       GitHub Actions
data/fixtures.json       Public fixture content
docs/                    Maintainer and content-editing guides
migrations/              Ordered PostgreSQL migrations
openspec/                Proposals, designs, and acceptance scenarios
public/                  PWA manifest, icons, and service worker
scripts/                 Commands grouped by admin, assets, content, database, docs, and setup
server/                  Express API, access rules, stores, and workflows
shared/                  Validation and policy data used by both sides
src/                     React application and styles
tests/                   Node tests, including PostgreSQL integration tests
```

Put shared colours and spacing in `src/styles/tokens.css`. Put reusable
component rules in `src/styles/app.css`. Check `src/components/ui.jsx` before
adding a new page-specific component.

## Security and privacy

Before deployment:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
```

Passwords are hashed with scrypt. Session, invitation, and reset tokens are
random and stored as hashes. Resetting a password ends every active session for
that account.

Anonymous responses exclude private meeting links, channels, Drive links, and
contact details. Cited Hub search has stricter source-side exclusions for
account records, credentials, guardian data, minority data,
and personal contact fields.

The Search page combines ordinary page matching with the governed, cited
cross-record answer flow. The old `/intelligence` URL redirects to `/search`;
the authorization and audit boundaries remain server-side.

## Deployment

Railway reads `railway.json` and performs these steps:

1. build with `npm run build`
2. apply migrations with `npm run migrate`
3. start the server with `npm start`
4. check `/healthz`

### Publish a local change

Railway cannot deploy uncommitted files. First turn the verified worktree into
a Git commit and push it:

```bash
npm run check
git diff --check
git add --all
git status --short
git commit -m "Describe the Hub change"
git push origin main
```

Check the `git status` output before committing. It is the final list of files
that will be published. After pushing, open the GitHub **Verify** workflow and
confirm both Node versions pass for the new commit.

If Railway is connected to GitHub, its service source must point to this
repository and the `main` branch. Confirm that the deployment shows the same
commit SHA returned by:

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Those two hashes must match. If GitHub has the commit but Railway does not
deploy it, repair the Railway service's repository/branch connection or deploy
the verified worktree explicitly to staging:

```bash
railway up --environment staging --service youngo-hub
```

Staging: <https://web-staging-31ab.up.railway.app>

Check `/healthz` and the changed user journeys on staging before promoting the
same build to production. Do not use a production deployment to find out
whether migrations or authentication changes work.

This repository does not contain a GitHub Actions deployment job. Automatic
deployment after a push depends on the Railway service's GitHub connection and
branch settings.

The current hosting stack is not replaced by Vercel or Supabase. Before any
migration, first confirm that the intended commit exists on GitHub `main` and
that Railway is watching that branch. A future database move can point the
existing server at Supabase Postgres through `DATABASE_URL`; moving the Express
runtime to Vercel would be a separate serverless deployment change.

## Known gaps

- Most public content types still require a fixture change and pull request.
- Password-reset and invitation links do not have an email provider.
- Registration still collects several fields that should be reviewed against
  the final membership process and data-minimisation requirements.
- PostgreSQL authorization and simultaneous invitation acceptance need broader
  integration coverage.
- If one account holds several active organisation seats, the Hub currently
  uses the most recently accepted seat.
- The onboarding flow still needs final review by the YOUNGO Onboarding
  Taskforce.
