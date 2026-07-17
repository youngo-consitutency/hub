# Change: add-ics-feeds

## Why

The Hub's core promise is "never miss a call," but the public MVP only *displays* the
agenda — members still have to hand-copy meeting times into their own calendars. ICS
subscription feeds close that loop: subscribe once, and YOUNGO's calls appear (with the
right UTC time, the meeting link, and a 15-minute reminder) in Google/Apple/Outlook
forever. Specified in `01-product-spec.md` (ICS subscription feeds), `03-screens-ux.md`
(§2 Calendar subscribe sheet, event "Add to calendar", §5 per-WG subscribe), and
`04-api-data-spec.md` (§ ICS endpoints).

## What Changes

- New `server/lib/ics.js` — pure RFC 5545 VCALENDAR/VEVENT builder (UTC times, escaped
  text, 75-octet line folding, CRLF, a `-PT15M` VALARM per event). Unit-tested.
- New `server/routes/ics.js` mounted at `/ics`, `text/calendar` + `max-age=900`:
  `all.ics`, `type/:type.ics`, `wg/:slug.ics`, and single-event `event/:slug.ics`.
- `store.listEventsForIcs()` — forward 90-day window with optional type/WG filter.
- Client: Calendar "Subscribe" panel (copy feed URLs + Google Calendar how-to), event
  detail "Add to calendar" download, WG page "Subscribe to this WG".

## Impact

- Affected specs: calendar, working-groups (ICS surfaces ADDED).
- Affected code: `youngo-hub` server (`lib/ics.js`, `routes/ics.js`, `store.js`,
  `index.js`) and client (`Subscribe.jsx`, Calendar/EventDetail/GroupDetail).
- Out of scope: the P2 per-user token feed (`/ics/me/:token.ics`) — needs
  `add-members-auth`. RRULE occurrence expansion lands with the admin/Postgres path
  (`04 §recurrence`); fixtures carry single occurrences today.
