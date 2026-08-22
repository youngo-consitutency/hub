# YOUNGO Hub CRM system design

Status: implementation direction for the existing React, Express, and PostgreSQL Hub.

## Product boundary

YOUNGO Hub should remain the constituency's operational system of record, not a
generic sales CRM. It owns memberships, organisations, working-group assignments,
events, submissions, decisions, directory entries, content workflow, and the audit
trail. WhatsApp, mailing lists, Google Drive, and Google Calendar remain connected
delivery channels.

The maintainable default is the existing custom application and PostgreSQL schema.
Do not rebuild the product around a large CRM platform or expose authentication and
private member tables directly through a generic admin tool.

## Roles and scopes

Authorization stays source-side in `server/lib/access.js`. Pages may hide controls,
but the API must enforce every capability independently.

| Role | Default scope | Typical capabilities |
| --- | --- | --- |
| Member | Own account and public/member content | View, subscribe, express interest, submit |
| Working-group Contact Point | Assigned working groups | Manage group profile, contacts, meetings, resources, and submissions |
| Membership Team | Membership queue | Review applications, verify course completion, correct membership metadata |
| GYS Policy Team | Youth Statement workspace | Draft, review, and publish statement content and consultation records |
| Content editor | Assigned content collections | Create and revise drafts |
| Content publisher | Approved collections | Review, schedule, publish, archive |
| NGO representative | Own organisation | Maintain organisation profile, seats, and verified contributions |
| Global Focal Point | Constituency-wide operations | Coordinate cross-team records, approve sensitive changes, inspect audit evidence |
| Platform admin | Platform configuration | Manage roles, integrations, security settings, and emergency recovery |

People can hold multiple assignments. Capabilities should be additive and scoped to
specific working groups, teams, organisations, or content collections. Platform
roles should stay rare.

## Core data model

Keep shallow, explicit tables with stable identifiers:

- `accounts`, `memberships`, `organisations`, `organisation_seats`
- `working_groups`, `working_group_assignments`, `contact_channels`
- `events`, `event_occurrences`, `submissions`, `decisions`
- `content_records`, `content_versions`, `content_reviews`
- `role_assignments`, `capability_grants`
- `calendar_connections`, `calendar_event_links`, `integration_receipts`
- `audit_events`

Every mutable operational record needs `created_by`, `updated_by`, timestamps, a
revision/version, and an audit event for privileged transitions. Sensitive member
and guardian data must remain outside public content and search indexes.

## Editorial lifecycle

Use one lifecycle across events, opportunities, announcements, working-group pages,
COYs, and statement content:

1. Draft
2. In review
3. Changes requested or approved
4. Scheduled or published
5. Archived

Editors should not publish their own sensitive changes unless a policy explicitly
allows it. Publishing is idempotent, records the approved revision, and never mutates
the source draft silently. The existing `/staff/content` surface is the preferred
editor interface; add collection-specific forms there before adding a second CMS.

## Google Calendar mirror

Start with a one-way Google Calendar to Hub mirror. The Hub decides audience,
visibility, working-group ownership, and governance metadata; Google supplies the
shared scheduling record.

### Sync contract

1. Connect one managed Google calendar to one Hub calendar connection.
2. Run a full import and persist Google's `nextSyncToken`.
3. Run incremental syncs with that token, including cancellations and deletions.
4. If Google returns `410`, clear the stale token and perform a controlled full
   resync.
5. Treat Google push notifications as invalidation signals, then fetch the actual
   changes from the API.
6. Run periodic reconciliation so missed webhooks cannot leave the Hub stale.

Store the provider calendar ID, event ID, recurring-event ID, original occurrence
start, ETag, sync token, last-synced time, deletion state, and an idempotency key.

Use a single-writer rule to avoid loops. Phase one is read-only Google to Hub. A
later Hub-to-Google workflow can be added only for authorized Contact Points, with
explicit conflict handling and audit events.

Use user OAuth for user-owned calendars. Use a service account or domain-wide
delegation only for organisation-controlled shared calendars and only with explicit
Google Workspace administrator approval.

Official implementation references:

- <https://developers.google.com/workspace/calendar/api/guides/sync>
- <https://developers.google.com/workspace/calendar/api/guides/push>

## Platform choices

### Recommended now

Keep the current React/Express/PostgreSQL platform and extend the existing Content
Studio. This keeps one authorization model, one audit trail, and the lowest migration
cost.

### Optional operations console

Use Directus only if non-technical operators need generic table, relationship, and
workflow views that the Content Studio does not justify building. Put it behind the
Hub API or on a dedicated operations schema. Do not give it direct access to session,
credential, guardian, or private-message tables.

Payload is the stronger alternative if the team wants a code-first TypeScript CMS
inside the application. Its draft/version/access model fits governed publishing, but
adopting it would be a larger migration than continuing the existing studio.

Supabase can provide managed Postgres, authentication, storage, and row-level
security if the team chooses to migrate infrastructure. It should not be introduced
only for UI convenience while Railway and the current API remain healthy.

Airtable is suitable for short-lived intake pilots or imports. It should not become
the source of truth for membership, permissions, personal data, or governance
decisions. A traditional sales CRM is not recommended unless YOUNGO later needs a
separate fundraising pipeline. CiviCRM is worth evaluating only if constituent-case,
donor, or dues management becomes a real requirement.

## Accessibility contract

The Hub targets WCAG 2.2 AA and must be usable without sight or a pointing device.
Code-level conformance is necessary but not a certification; release checks must
include VoiceOver and NVDA testing by people using those tools.

- Use one logical heading structure and named page landmarks.
- Use real links for navigation and real buttons for actions; never clickable generic
  containers without equivalent semantics.
- Keep the skip link, visible keyboard focus, 44px touch targets, and full keyboard
  operation.
- Every dialog must trap focus while open, close with Escape, expose an accessible
  name, and return focus to its trigger.
- Announce async loading, errors, result counts, and successful saves with appropriate
  status or alert regions.
- Labels, help text, errors, and required state must be programmatically associated
  with form controls.
- Never communicate state by colour alone. Icons that add meaning need text or an
  accessible name; decorative icons stay hidden from assistive technology.
- Preserve browser zoom, 320px reflow, text wrapping, and user font preferences.
- Keep motion short and functional, and remove it when `prefers-reduced-motion` is
  enabled.
- Prefer native controls. A custom date picker or combobox is acceptable only when it
  matches native keyboard, focus, announcement, and validation behavior.

## Responsive layout contract

- Catalogue cards: four bounded columns on wide screens, then three, two, and one.
- Detail and form cards: use their natural content width; do not stretch them merely
  to fill the viewport.
- Text measure: approximately 62 characters for prose.
- Actions sit at the trailing edge when that preserves the reading order, then stack
  below content on narrow screens.
- No horizontal page rails on the home dashboard. Overflow scrolling is reserved for
  controls that are inherently one-dimensional and still have keyboard alternatives.

## Development and release cycle

1. Write an OpenSpec change with user journeys, data ownership, access matrix, and
   privacy constraints.
2. Add schema migrations and server-side capability tests before the UI depends on
   new records.
3. Build behind a feature flag with fixture data and role-specific demo accounts.
4. Test semantic markup, keyboard order, focus restoration, zoom/reflow, contrast,
   reduced motion, VoiceOver, and NVDA.
5. Run `npm run format`, `npm run lint`, `npm test`, and `npm run build`.
6. Review content and permissions with the responsible YOUNGO team.
7. Deploy to Railway staging, exercise integration failure/retry paths, observe logs,
   then promote to production.

## Delivery sequence

1. Stabilize the shared card, filter, dialog, and navigation contracts.
2. Complete role-scoped Content Studio forms for every editable collection.
3. Add Google Calendar read-only sync with reconciliation and an integration audit
   view.
4. Add Contact Point and Global Focal Point queues based on capabilities, not cloned
   applications.
5. Add approved write-back to Google Calendar only after the read-only mirror is
   reliable.
6. Evaluate Directus or Payload only after operators identify a concrete workflow the
   existing Content Studio cannot maintain cheaply.
