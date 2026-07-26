# Editing Hub content

Events and announcements are edited in the Hub. Other public content still
lives in `data/fixtures.json`.

## Events and announcements

Open **Content Studio** from the Hub sidebar.

- A content editor creates a draft and submits it for review.
- A content publisher reviews the draft.
- The original editor cannot review or publish their own work.
- Approved content must still be published as a separate action.
- Every change of status is recorded in the audit log.

An admin can assign the `content_editor` and `content_publisher`
responsibilities from the account administration page.

Use the form validation messages to correct missing or invalid fields. Published
events replace fixture events with the same slug; published announcements work
the same way.

## Fixture-backed content

These sections still come from `data/fixtures.json`:

- working groups
- submissions
- Council items
- COYs
- directory contacts

You do not need to change React or server code to update them.

1. Create a Git branch.
2. Open `data/fixtures.json`.
3. Find the relevant list, such as `"groups"` or `"directory"`.
4. Copy an item with the same shape and replace its values.
5. Run `npm run content:check`.

JSON has a few strict rules:

- Keep double quotes around text.
- Separate items with commas.
- Do not put a comma after the final item in a list.
- Do not reuse a `slug`; it is the permanent identifier used in links.
- Use complete URLs beginning with `https://`.

## Event fixture example

Use Content Studio for normal event updates. Fixture events remain useful for
seed data and local demos:

```json
{
  "slug": "finance-call-august",
  "title": "Finance working-group call",
  "type": "wg_call",
  "startsAt": "2026-08-14T12:00:00Z",
  "durationMin": 60,
  "wg": "finance",
  "meetingUrl": "https://example.org/meeting"
}
```

A timestamp ending in `Z` is in UTC. Supported event types are:

- `constituency_call`
- `wg_call`
- `wgf`
- `unfccc_session`
- `webinar`
- `coordination`

Demo events may use `dayOffset` and `hourUtc` to stay relative to the current
date. Use `startsAt` for a fixed date.

The `wg` value must match a working-group slug in the `"groups"` list.

## Directory

Directory entries use one of these groups:

- `focal_points`
- `liaisons`
- `operations`
- `wg_contacts`

Headings and display order live in `src/content/directory.js`. Email addresses
and role descriptions live in `data/fixtures.json`.

## Validate a change

Run:

```bash
npm run content:check
```

The command reports the item and field that need attention. Before opening a
pull request, run:

```bash
npm run check
```

GitHub Actions formats pushed code and runs the full check on Node 20 and
Node 22.
