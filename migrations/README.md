# Database migrations

Migrations are forward-only and run in filename order through `npm run migrate`.
The runner records the complete filename in `schema_migrations`, so an applied
file must never be renamed or edited.

Two historical migrations use the `009` prefix. Keep both names unchanged;
their full filenames provide a stable order. New migrations must use the next
unused numeric prefix.

Member messaging was removed in migration `019_remove_member_messaging.sql`.
Keep the historical messaging migration unchanged so existing databases can
move forward through the same ordered migration history.
