# Maintenance scripts

Scripts are grouped by what they operate:

- `admin/` — explicit account administration
- `assets/` — generated icons and other static assets
- `content/` — fixture-content validation
- `database/` — schema migration commands
- `docs/` — documentation capture and maintenance
- `setup/` — optional local or deployment setup helpers
- `research/` — one-shot local research helpers (not CI)

### WG meeting links from WhatsApp

If your phone is already in YOUNGO WG groups:

```bash
npm install -D @whiskeysockets/baileys qrcode-terminal pino
npm run research:wg-meetings
```

Scan the QR printed in the terminal (WhatsApp → Linked devices). Keep the process
running ~45s for history sync. Output: `data/research/wg-meeting-links.json`
(gitignored). Session: `.local/baileys/`.

Optional: `WG_WA_HISTORY_WAIT_MS=60000` for a longer sync window.

Use the matching npm script where one exists. This keeps paths stable for local
development and CI.
