# Editing Hub content

Most calendar entries, working groups, submissions, Council items, COYs, announcements, and directory contacts live in one file:

`data/fixtures.json`

You do not need to understand React or the server to update that content.

## Before you edit

1. Make a new Git branch.
2. Open `data/fixtures.json` in GitHub or a code editor.
3. Find the section you need, such as `"events"` or `"directory"`.
4. Copy a similar item and change its values.

JSON is strict:

- Keep the double quotes around words.
- Put a comma between items, but not after the last item in a list.
- Do not reuse a `slug`. It is the item’s permanent ID and appears in links.
- Use full links beginning with `https://`.

## Events

Events can use a fixed time:

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

Times ending in `Z` are UTC. Event types currently supported are:

- `constituency_call`
- `wg_call`
- `wgf`
- `unfccc_session`
- `webinar`
- `coordination`

The demo entries also support `dayOffset` and `hourUtc`, which keep dates moving relative to today. Use `startsAt` for real published events.

The `wg` value must match a working-group `slug` in the `"groups"` section.

## Directory

Directory entries use one of these groups:

- `focal_points`
- `liaisons`
- `operations`
- `wg_contacts`

The order and headings of the directory structure live in `src/content/directory.js`. Email addresses and role descriptions stay in `data/fixtures.json`.

## Check your change

From the project folder, run:

```bash
npm run content:check
```

The command explains the exact item that needs fixing. Before opening a pull request, run the full check:

```bash
npm run check
```

GitHub runs the same checks on every pull request, so broken content cannot be merged unnoticed.
