# YOUNGO Hub production architecture, governance, and automation plan

Status: system review and implementation direction, 2026-08-28.

This document separates what the repository already does from what still needs to
become operational. The current working tree is locally verified but is not the
deployed production state. Infrastructure, role-boundary, and data-authority
changes require staging and YOUNGO governance approval.

## Executive decision

Keep the existing React, Express, and PostgreSQL application. Do not rebuild the
Hub as microservices, a generic CRM, or a collection of external forms. For the
first several thousand members, one small application server is enough if public
responses are cached, database queries are bounded, and background work is queued.

The recommended production shape is:

1. Cloudflare DNS, TLS, CDN, and basic edge protection.
2. One Ubuntu server running Caddy, the Node application, PostgreSQL, and one job
   worker under Docker Compose or systemd.
3. Encrypted daily database and upload backups copied off the server.
4. Amazon SES for transactional email.
5. GitHub Actions for tests, staging deployment, migration checks, and explicit
   production promotion.
6. Membership Team ownership of production data credentials and backups; Hub
   developers receive deployment access but no interactive production-database
   login.

This is a deliberately boring architecture. It is inexpensive, understandable by
a small rotating team, and can later move PostgreSQL or the worker to a separate
service without rewriting the product.

## Honest budget boundary

USD 30-50 **per year** is a pilot budget, not a high-availability budget. It can
buy one small server, but not a redundant server, managed database, paid monitoring,
and managed backups at the same time.

Current published base prices checked on 2026-08-28:

| Option                               | Compute                        | Annual compute | Assessment                                                                                                       |
| ------------------------------------ | ------------------------------ | -------------: | ---------------------------------------------------------------------------------------------------------------- |
| AWS Lightsail Nano, IPv6-only        | 0.5 GB RAM, 2 vCPU, 20 GB SSD  |         USD 42 | Fits the hard cap; PostgreSQL and Node need strict memory tuning and swap. No server redundancy.                 |
| DigitalOcean Basic                   | 512 MiB RAM, 1 vCPU, 10 GB SSD |         USD 48 | Fits the hard cap exactly; too little storage and memory headroom for a comfortable long-term production system. |
| AWS Lightsail Micro, IPv6-only       | 1 GB RAM, 2 vCPU, 40 GB SSD    |         USD 60 | Recommended minimum if IPv6-only origin operations are acceptable.                                               |
| DigitalOcean Basic                   | 1 GB RAM, 1 vCPU, 25 GB SSD    |         USD 72 | Recommended simple DigitalOcean starting point.                                                                  |
| AWS Lightsail Micro with public IPv4 | 1 GB RAM, 2 vCPU, 40 GB SSD    |         USD 84 | Easiest small AWS deployment when IPv4 origin access is required.                                                |

Official references: [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets)
and [Amazon Lightsail bundle pricing](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html).

The hard-cap pilot can use Cloudflare's free plan, Cloudflare R2's 10 GB-month
free tier for encrypted backups, and Amazon SES at USD 0.10 per 1,000 outgoing
messages. References: [Cloudflare free plan](https://www.cloudflare.com/plans/free/),
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), and
[Amazon SES pricing](https://aws.amazon.com/ses/pricing/).

Domain registration, VAT, storage beyond the free allowance, and human support
time are not included. A practical annual operating budget is therefore:

- **USD 42-50 pilot:** 512 MB single server, free-tier edge and backup storage,
  SES usage. Recoverable, but memory-constrained and not highly available.
- **USD 60-100 recommended floor:** 1 GB single server, off-site backups, SES,
  and enough headroom for PostgreSQL, the application, and a small worker.
- **USD 200+ reliability tier:** separate or managed PostgreSQL, provider backups,
  and optionally a warm standby. This is where a meaningful availability target
  becomes realistic.

The team should not describe the USD 42-100 single-server shape as 99.9% highly
available. Its reliability comes from prevention, monitoring, and tested recovery,
not redundancy.

## Current repository: real, partial, and placeholder

| Area                         | Current state                                                                                                                                              | Production gap                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and lifecycle | Real account registration, password sessions, course verification, suspension, and audited admin changes                                                   | MFA, recovery email delivery, mandate expiry, and two-person privileged approval                                                            |
| Authorization                | Server-side access profile with platform roles, team roles, WG assignments, organisation seats, and named capabilities                                     | `admin` still automatically inherits Membership Team and GYS roles; several routes still check broad roles rather than narrow capabilities  |
| Working groups               | Scoped Contact Point/lead assignments, workspace unlock, activities, member profiles, and protected resources                                              | Complete editor forms, mandate expiry, source ownership, and scheduled stale-link checks                                                    |
| Organisations                | Organisation accounts, owner/representative/viewer/affiliate seats, invitations, affiliation requests, service requests, opportunity publishing and review | A dedicated organisation verification case, evidence, review states, expiry, suspension, and annual renewal                                 |
| Content                      | Governed event/announcement draft-review-publish workflow in `/staff/content`                                                                              | More content types, scheduled publication, source connectors, and stale-content handling                                                    |
| Calendar                     | Good member UI, ICS export, fixture/content-publication event read model                                                                                   | No authoritative calendar connection, sync token, reconciliation worker, or connector operations page                                       |
| Opportunities                | Organisations can create postings; first postings can be reviewed; trusted organisations can publish                                                       | Trust must depend on organisation verification, not only a previously approved posting                                                      |
| DMP/Council                  | Database tables and a read UI for proposal/input/objection/outcome states                                                                                  | Current list is fixture-backed; no create/edit transition API, red-flag mechanism, objections, outbox notifications, or email delivery      |
| Notifications                | Web-push subscription and audited admin push delivery exist                                                                                                | VAPID may be unconfigured; no durable notification outbox, email provider, preferences by topic, retry worker, or digest                    |
| Data source                  | Many catalogue records still come from `data/fixtures.json`, with published events/announcements overlaying fixtures                                       | Replace fixtures with governed database records and provenance-aware imports before launch                                                  |
| Operations                   | CI checks and Dependabot configuration exist                                                                                                               | No deployment manifest for a VPS, background scheduler, backup job, restore drill, connector health dashboard, or production promotion gate |

“Self-updating” must mean that approved authoritative sources stay synchronized and
fail visibly. It must not mean that arbitrary links or scraped text silently mutate
governed records.

## Existing roles and how to inspect them

Different roles already exist, but the final governance model is not complete.

### Implemented assignments

- Platform roles: `member`, `focal_point`, `wg_contact`, `ngo_admin`, `admin`.
- Team roles: `membership_team`, `gys_policy_team`, `content_editor`,
  `content_publisher`.
- Working-group assignments: `contact` and `lead`, scoped to one WG.
- Organisation seats: owner, representative, viewer, and affiliation-only links.
- Access is derived in `server/lib/access.js`; API guards remain authoritative even
  when a page hides a control.

### Check through the product

1. Sign in with a verified platform-admin account.
2. Open `/admin`.
3. Search for an account and open its account manager.
4. Inspect or change the platform role and team assignments. Every change requires
   a reason and enters the audit log.
5. Sign in as the affected account and open `/profile`; assigned platform, team,
   and WG roles are listed there.
6. Confirm its role-specific workspace appears on Home: `/team/membership`,
   `/staff/content`, `/team/gys`, `/focal`, `/cp`, or `/ngo` as
   applicable.
7. Do not treat a visible navigation item as proof. Exercise one allowed and one
   forbidden API action and verify the server response.

### Check with local demo personas

Use a disposable local or staging database only:

```sh
DATABASE_URL=postgres://... npm run migrate
DATABASE_URL=postgres://... DEMO_PASSWORD='a-long-staging-password' npm run seed-demo-accounts
```

The seed script creates ordinary, pending, admin, focal-point, WG Contact Point,
WG lead, Membership Team, GYS, editor, publisher, NGO admin, and NGO representative
personas. Never run it against production unless the explicit production guard and
the clean-up plan have been reviewed.

### Required role refactor

Do not add more global roles to solve every workflow. Make assignments time-bounded
and scoped, then derive capabilities such as:

- `platform.assignments.manage`
- `membership.applications.read` and `membership.applications.decide`
- `organisations.verification.review`
- `governance.dmp.create`, `.moderate`, `.red_flag`, and `.decide`
- `content.events.draft`, `.review`, and `.publish`
- `integrations.calendar.manage`
- `operations.deploy`, `.jobs.read`, and `.restore_test`

Remove automatic `admin -> membership_team` inheritance. A platform administrator
should configure the Hub without automatically receiving member-record access.

## Governance and ownership model

| Assignment               | Scope                                    | May do                                                                                              | Must not do                                                 |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Council governor         | Governance                               | Ratify policy, appoint mandate holders, review aggregate audit evidence, approve exceptions         | Browse raw member records or deploy code by default         |
| Global Coordination Team | Constituency operations                  | Coordinate cross-WG records and constituency notices                                                | Read private membership evidence or infrastructure secrets  |
| Membership Team          | Membership and organisation verification | Review applications/evidence, manage lifecycle, recover accounts, run exports, own data credentials | Publish its own governed content without independent review |
| WG Contact Point         | One WG                                   | Manage that WG profile, members, meetings, resources, submissions, and DMP proposals within scope   | Manage another WG or unrelated member records               |
| Organisation owner       | One organisation                         | Maintain profile, seats, verification case, and postings                                            | Self-verify or inspect another organisation                 |
| Content editor           | Assigned collections                     | Draft and submit                                                                                    | Publish its own revision                                    |
| Content publisher        | Assigned collections                     | Independently review, schedule, publish, and archive                                                | Read Membership Team evidence                               |
| Hub operations           | Application and jobs                     | Deploy verified releases, rotate application secrets, inspect redacted telemetry                    | Interactive production PII queries or unapproved exports    |
| Break-glass operator     | Time-limited incident                    | Perform one approved emergency procedure with a second approver                                     | Retain standing access after expiry                         |

All privileged assignments need an owner, reason, start, expiry, appointing body,
and revocation record. Require MFA for mandate holders and infrastructure accounts.

## Separate data authority from developers

At the USD 30-100 single-server tier, physical provider separation is expensive,
but human access can still be separated correctly:

- YOUNGO Membership Team owns the cloud account recovery identity, encrypted backup
  key, and two human database break-glass credentials.
- Hub developers deploy through GitHub Actions. They do not receive an interactive
  production database password.
- The application uses a restricted runtime database role.
- Migrations use a separate short-lived role exposed only to the protected release
  job.
- Membership exports run through an audited application workflow, not `psql` from
  a developer laptop.
- Sensitive PII belongs in a private schema. Public and operational records refer
  to opaque account IDs and approved views.
- Backups are client-side encrypted before upload; the object-store operator must
  not possess the decryption key.

When the budget permits, move PostgreSQL into a separately owned provider account
without changing the application API. If YOUNGO later requires that the Hub runtime
never hold a member-data credential, introduce a Membership API as a separate data
plane. Do not pay that complexity cost before the governance requirement exists.

## Organisation verification

Do not overload `hub_accounts.member_status = verified`. A person passing the
membership course and an organisation being institutionally verified are different
claims.

Add these records:

- `organisation_verification_cases`: organisation, status, submitted/reviewed
  timestamps, reviewer, expiry, risk level, decision reason, policy version.
- `organisation_verification_evidence`: evidence type, issuer, URL or encrypted
  object key, checksum, submitted by, visibility, expiry.
- `organisation_verification_reviews`: independent reviewer, decision, reason,
  checklist results, timestamp.
- `organisation_status_log`: append-only transitions and suspension/revocation.

Recommended lifecycle:

`draft -> submitted -> under_review -> needs_changes -> verified`

Terminal or exceptional states: `rejected`, `suspended`, `expired`, and `revoked`.

Rules:

1. Organisation owners submit legal identity, youth-led/youth-serving evidence,
   official website/domain, Contact Point details, and UNFCCC admission evidence
   where claimed.
2. Membership Team reviews a checklist and records sources. High-risk or disputed
   cases require a second reviewer.
3. The organisation cannot verify itself. Platform developers cannot decide cases.
4. Verification expires, normally annually, and reminders begin 60 and 30 days
   before expiry.
5. Only verified organisations can receive the verified badge, hold trusted posting
   status, nominate representatives to sensitive workflows, or appear in official
   recognition views.
6. A suspension immediately removes privileged capabilities but preserves the audit
   trail and public correction notice where policy requires it.

Build the case queue inside the existing Membership Team workspace, not a second
admin application.

## Self-updating content and calendar

### One canonical content record

Events, opportunities, resources, organisations, COYs, submissions, and DMPs should
share provenance fields:

- `source_type`, `source_id`, and `external_id`
- `source_url` and `source_owner`
- `source_updated_at`, `last_synced_at`, and `last_seen_at`
- `content_hash` and `integration_receipt_id`
- `verification_status`, `verified_by`, and `verified_at`
- `published_revision_id`, `expires_at`, and `archived_at`

An adapter writes a normalized candidate revision. The publication workflow decides
whether that revision becomes visible.

### Calendar connector

Start with one-way Google Calendar to Hub synchronization:

1. The Global Coordination Team or WG Contact Point connects an approved shared
   calendar to a scoped Hub collection.
2. The worker performs one full sync and stores `nextSyncToken`.
3. It runs incremental sync every 15 minutes, upserts by provider event ID, and
   processes cancellations.
4. A webhook only wakes the worker; it is not trusted as event data.
5. A nightly reconciliation detects missed notifications.
6. Google HTTP `410` invalidates the token and triggers a controlled full resync.
7. Unexpected ownership, audience, link, or visibility changes enter review rather
   than auto-publish.

Google documents the full-sync, persistent-token, incremental-sync, and `410`
recovery contract in its [Calendar synchronization guide](https://developers.google.com/workspace/calendar/api/guides/sync).

### Link and content health

Run scheduled jobs that:

- issue `HEAD` or bounded `GET` requests with strict timeouts;
- record status, redirects, content type, latency, and consecutive failures;
- never follow redirects to private networks;
- quarantine a link after repeated failure and notify its source owner;
- flag records not seen from their source for a defined stale period;
- archive expired opportunities and completed events without deleting history.

Internal member links remain protected behind workspace access even when the health
checker can reach them.

### Worker and job model

Use a PostgreSQL-backed job table and one worker process before adopting Redis:

- claim jobs with `FOR UPDATE SKIP LOCKED`;
- include an idempotency key and attempt counter;
- use exponential backoff and a dead-letter state;
- store redacted failure details and correlation IDs;
- expose job health, last success, next run, and retry controls to Hub operations;
- ensure only one scheduler enqueues each recurring job.

Suggested schedules:

- calendar incremental sync: every 15 minutes;
- due notification delivery: every minute;
- link health: daily, spread across the day;
- stale-content and mandate expiry: daily;
- database backup: daily, with weekly and monthly retention;
- full source reconciliation: nightly or weekly depending on authority and volume.

## DMP workflow and notifications

The existing `dmp_decisions` and `dmp_status_log` tables are a useful starting point,
but the current member UI is a read-only fixture view. Build the operational DMP as
a governed state machine.

### States

`draft -> proposed -> open_for_input -> objection_window -> decided -> archived`

Exceptional states: `paused`, `withdrawn`, `not_adopted`, and `cancelled`.

### Required records

- proposal and immutable proposal revisions;
- sponsor/proposer and scoped authorizing body;
- input-window and objection-window deadlines;
- comments, objections, endorsements, and uploaded/source-linked evidence;
- red flags with category, reason, reporter, confidentiality, owner, expiry, and
  resolution;
- transition log and final outcome;
- notification audience snapshots and delivery receipts.

### Red flags

A red flag is a review hold, not a deletion button. It pauses deadline automation
for defined categories such as mandate, conflict of interest, process violation,
safeguarding, privacy, or factual integrity. The reporter receives a receipt; the
assigned reviewer must resolve, escalate, or dismiss it with a reason. Safeguarding
and privacy flags use restricted visibility.

### Email and in-app delivery

Every DMP transition writes a notification intent to the same database transaction.
A worker sends it later. This transactional-outbox pattern prevents a successful
decision transition from losing its email because the email provider was briefly
unavailable.

Initial notifications:

- DMP proposed;
- input window opened and closing reminders;
- objection window opened and closing reminders;
- red flag raised/resolved for the permitted audience;
- outcome published;
- daily or weekly digest for members who choose digest mode.

Use Amazon SES for delivery, store no provider secret in the repository, suppress
repeated bounces, include unsubscribe/preference links for non-essential mail, and
never place sensitive objection text in an email subject or push payload.

## Integrating YOUNGO mechanisms and documents

Uploaded policy documents must inform workflows without silently becoming executable
authority.

For each mechanism:

1. Store the original document, checksum, issuer, approval date, version, and public
   source.
2. Extract a plain-language process map: actors, inputs, states, deadlines,
   approvals, objections, notifications, evidence, and retention.
3. Draft an OpenSpec change and a role/capability matrix.
4. Review that interpretation with the process owner and Membership Team where PII
   is involved.
5. Encode the workflow as versioned server-side transitions and validation, not
   client-only buttons.
6. Test happy paths, forbidden paths, deadline races, retries, suspension, and audit
   evidence with synthetic accounts.
7. Pilot behind a feature flag; only then migrate real records.

Hub Intelligence may help members find and understand cited policy evidence, but it
must not turn an answer directly into a DMP, membership, event, submission, or message
mutation. Existing intelligence writeback approval invariants remain unchanged.

## Performance and low-resource operation

The current Vite SPA is suitable for this budget. Keep it light by enforcing:

- route-level lazy chunks and system fonts;
- immutable caching for hashed assets, short CDN caching for public API projections,
  and `no-store` for authenticated responses;
- Brotli or gzip at Caddy/Cloudflare;
- database pagination, query timeouts, and indexes based on measured slow queries;
- a small PostgreSQL connection pool, normally 4-6 connections on one app instance;
- thumbnail generation and strict image dimensions before storing profile photos;
- no binary documents or unbounded audit payloads in primary PostgreSQL tables;
- no AI call on ordinary page loads;
- API and integration timeouts, body limits, rate limits, and circuit breakers;
- service-worker caches that exclude API responses and authentication state.

For 512 MB, tune PostgreSQL conservatively, cap Node heap, add encrypted swap, and
run only one worker with concurrency 1. Measure resident memory before launch. If
swap is regularly active or the database exceeds 70% disk, move to 1 GB rather than
trying to optimize around exhaustion.

## Deployment and recovery runbook

### Runtime layout

- Caddy terminates origin TLS and proxies `/api` and the SPA to Node.
- Node serves the built Vite assets and API.
- PostgreSQL binds only to localhost or a private container network.
- The worker runs the same application image with a separate command.
- SSH is key-only, restricted by firewall, and not needed for ordinary releases.

### Release path

1. Pull request runs content checks, formatting, lint, tests, build, migration tests,
   and dependency audit.
2. Merge to protected `main` deploys staging automatically.
3. Staging applies migrations, runs health and role-specific smoke tests, and verifies
   connector failure paths.
4. A named release approver promotes the immutable image to production.
5. Production runs backward-compatible migrations, health checks, and a short smoke
   suite.
6. Rollback uses the previous image; migrations must remain compatible for at least
   one rollback window.

### Recovery targets for the single-server tier

- Initial recovery-point objective: 24 hours.
- Initial recovery-time objective: 4 hours during maintained hours.
- Daily encrypted logical backup; seven daily, four weekly, and six monthly copies.
- Weekly automated restore into a disposable database and integrity checks.
- Quarterly full recovery drill onto a clean server, timed and recorded.
- A two-person credential-rotation and suspected-data-exposure runbook.

Backups are not valid until a restore has succeeded.

## Observability and operating ownership

Track only signals the team will act on:

- uptime and `/healthz`;
- p50/p95 API latency and 5xx rate;
- database disk, connections, slow queries, backup age, and restore-test result;
- worker queue depth, oldest job age, retries, and dead letters;
- calendar/source freshness and link-health failures;
- emails sent, bounced, complained, and suppressed;
- privileged role changes, exports, DMP red flags, and emergency access;
- monthly compute, storage, email, and egress cost.

Run a weekly operational review and a quarterly access/restore review. Every critical
service must have at least two maintainers and an institutional recovery address.

## Phased delivery

### Phase 0: ratify the operating model

- Approve the role matrix, Membership Team data authority, Council oversight, Hub
  team appointment/removal, and break-glass policy.
- Choose the pilot or recommended budget floor and name the owner of DNS, cloud,
  database, backups, email, and repository recovery.
- Inventory every fixture and identify its authoritative owner/source.

### Phase 1: make the foundation production-safe

- Replace broad role checks with scoped capabilities and remove admin inheritance.
- Add assignment expiry and MFA for mandate holders.
- Add VPS deployment manifests, staging promotion, redacted telemetry, encrypted
  backup/restore automation, and SES.
- Move event/announcement fixtures into governed database records.

### Phase 2: make organisations real

- Add organisation verification cases, evidence, review queue, expiry, suspension,
  and audit.
- Gate organisation trust, postings, representation, and recognition on verification.
- Add renewal reminders and Membership Team reporting.

### Phase 3: make content self-updating

- Add the job table/worker and operations dashboard.
- Implement one authoritative Google Calendar connector end to end.
- Add source provenance, link health, stale-content review, and automatic archival.
- Expand Content Studio to the remaining governed catalogue types.

### Phase 4: operationalize DMPs

- Replace fixture-backed Council decisions with the database API.
- Add proposal/revision forms, scoped transitions, objections, red flags, audit, and
  notification outbox.
- Pilot one real DMP with a small cohort before constituency-wide email.

### Phase 5: launch and scale from evidence

- Load-test sign-in, directory, calendar, DMP-email fan-out, and search peaks.
- Pilot with mandate holders and a limited member cohort.
- Track latency, failures, source freshness, support load, and cost per active member.
- Move to 1-2 GB or a separate database when measurements—not guesswork—justify it.

## Production acceptance criteria

The Hub is ready for a broad launch only when:

- all public/member catalogue records have an owner, source, and freshness state;
- no production page depends on demo fixtures for operational truth;
- organisation verification and suspension are tested end to end;
- role tests prove both allowed and forbidden actions for every mandate;
- DMP transitions are audited and notification retries are idempotent;
- a clean-server restore has met the stated RPO/RTO;
- staging promotion and rollback have been exercised;
- no developer needs standing access to production member records;
- accessibility, 320 px reflow, keyboard use, and screen-reader smoke tests pass;
- the monthly bill, backup age, connector freshness, and job failures are visible to
  the operations team.

## Decisions required from YOUNGO

1. Is USD 30-50 a hard annual cash ceiling, or can YOUNGO approve the USD 60-100
   recommended single-server floor?
2. Does the Council accept governance authority without standing member-record
   access?
3. Which people or institutional accounts own DNS, cloud billing, backups, SES,
   GitHub, and emergency recovery?
4. Which calendar and content sources are authoritative enough to auto-publish, and
   which always require review?
5. What evidence and review policy defines a verified organisation?
6. Which DMP roles may propose, object, red-flag, pause, and record an outcome?
7. What retention periods apply to membership evidence, organisation evidence,
   objections, audit logs, and notification receipts?
