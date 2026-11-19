# Scripts

Run from the repository root. Scripts that write to the database read `DATABASE_URL` from `.env.local`, so check which database it names first. `agent/hub-mcp.mjs` never touches the database: it writes through the Hub API at `HUB_ORIGIN`, which `npm run sync:mcp` copies from `.env.local` into the generated client config, so check that origin instead. With `HINDSIGHT_API_KEY` set it also retains session memory to the Hindsight `youngo-hub` bank, a separate remote service. Agents never run writing scripts against production; a maintainer does.

| Script                           | Purpose                                                                          | Writes?                                      |
| -------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| `ci/vercel-build.mjs`            | Vercel build: migrates production first, skips previews                          | production only, on deploy                   |
| `ci/smoke.ts`                    | Pre-production smoke check against a started server; provisions a test account   | yes: the database named by `DATABASE_URL`    |
| `ci/mcp-smoke.mjs`               | CI handshake check for `mcp-content`                                             | no                                           |
| `agent/hub-mcp.mjs`              | Stdio MCP for local agents (content tools plus session memory)                   | Hub API at `HUB_ORIGIN`; memory to Hindsight |
| `agent/sync-mcp.mjs`             | Renders the MCP config for each tool (`npm run sync:mcp`)                        | local config files                           |
| `assets/*.mjs`                   | Regenerate brand, icon and illustration assets                                   | `public/`                                    |
| `ops/a11y-audit.mjs`             | axe-core on every route at four widths; run against a local disposable database  | no                                           |
| `ops/a11y-manual.mjs`            | Skip link, focus, heading and text-spacing checks that axe cannot make           | no                                           |
| `ops/shot.mjs`                   | Screenshot a local route at exact widths (`DIR=rtl` flips direction)             | writes PNGs                                  |
| `ops/any-ratchet.mjs`            | Fails if the count of untyped `AnyValue` uses grows (`--update` to lower it)     | `ops/any-baseline.json` with `--update`      |
| `ops/check-resource-links.ts`    | Probes resource URLs and files broken-link issues                                | dry run; `--apply` files issues              |
| `setup/grant-authority.ts`       | Last-resort authority grant (see AGENTS.md, Operator recovery)                   | dry run; `--apply`                           |
| `setup/map-directory-roles.ts`   | Gives focal point directory rows the `focal_point` role                          | dry run; `--apply`                           |
| `setup/import-legacy-content.ts` | One-way import of the legacy Hub's public content                                | dry run; `--apply`                           |
| `setup/import-legacy-members.ts` | One-way import of legacy member data                                             | dry run; `--apply`                           |
| `setup/seed-demo.ts`             | Loads the fictional demo dataset into an empty local database; refuses non-local | local database only                          |
| `setup/generate-vapid-keys.mjs`  | Prints a Web Push VAPID key pair                                                 | no                                           |

`lib/accountSpec.ts` is the shared account-provisioning helper used by scripts and test fixtures.

`design/` (repository root) holds the design-token build: `npm run design:build`, `design:check`, `design:groups`. See the [Design system](https://github.com/youngo-consitutency/hub/wiki/Design-system) wiki page.
