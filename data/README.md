# Data directory

`fixtures.json` is the only source-controlled data file in this directory. It
provides public content when the Hub runs without PostgreSQL.

The API also writes local JSON stores here in fixture mode. Those files contain
runtime or test data and are ignored by Git. Do not commit them.
