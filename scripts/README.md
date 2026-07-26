# Maintenance scripts

Scripts are grouped by what they operate:

- `admin/` — explicit account administration
- `assets/` — generated icons and other static assets
- `content/` — fixture-content validation
- `database/` — schema migration commands
- `docs/` — documentation capture and maintenance
- `setup/` — optional local or deployment setup helpers

Use the matching npm script where one exists. This keeps paths stable for local
development and CI.
