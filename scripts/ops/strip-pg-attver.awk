# Drops the column options only Supabase's Postgres understands from a plain SQL dump.
# Only the exact statement outside COPY data blocks is removed; rows are never touched.
/^COPY .* FROM stdin;$/ { in_copy = 1 }
!in_copy && /^ALTER TABLE ONLY [^ ]+ ALTER COLUMN [^ ]+ SET \(pg_attver=[0-9]+\);$/ { next }
/^\\\.$/ { in_copy = 0 }
{ print }
