# Scripts

Run from the repository root. Scripts that write to the database read `DATABASE_URL` from `.env.local`, so check which database it names first. `agent/hub-mcp.mjs` never touches the database: it writes through the Hub API at `HUB_ORIGIN`, which `npm run sync:mcp` copies from `.env.local` into the generated client config, so check that origin instead. With `HINDSIGHT_API_KEY` set it also retains session memory to the Hindsight `youngo-hub` bank, a separate remote service. Agents never run writing scripts against production; a maintainer does.

| Script                                 | Purpose                                                                        | Writes?                                      |
| -------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| `ci/vercel-build.mjs`                  | Vercel build: migrates production first, skips previews                        | production only, on deploy                   |
| `ci/smoke.ts`                          | Pre-production smoke check against a started server; provisions a test account | yes: the database named by `DATABASE_URL`    |
| `ci/mcp-smoke.mjs`                     | CI handshake check for `mcp-content`                                           | no                                           |
| `agent/hub-mcp.mjs`                    | Stdio MCP for local agents (content tools plus session memory)                 | Hub API at `HUB_ORIGIN`; memory to Hindsight |
| `agent/sync-mcp.mjs`                   | Renders the MCP config for each tool (`npm run sync:mcp`)                      | local config files                           |
| `assets/*.mjs`                         | Regenerate brand, icon and illustration assets                                 | `public/`                                    |
| `ops/check-resource-links.ts`          | Probes resource URLs and files broken-link issues                              | dry run; `--apply` files issues              |
| `setup/add-page-headings.ts`           | Fills missing About and Our work headings                                      | dry run; `--apply`                           |
| `setup/remove-x-link.ts`               | Drops the X link from the `connect` document                                   | dry run; `--apply`                           |
| `setup/remove-consultation-content.ts` | Removes the retired consultation banner, footer link and document              | dry run; `--apply`                           |
| `setup/grant-authority.ts`             | Last-resort authority grant (see AGENTS.md, Operator recovery)                 | dry run; `--apply`                           |
| `setup/map-directory-roles.ts`         | Gives focal point directory rows the `focal_point` role                        | dry run; `--apply`                           |
| `setup/import-legacy-content.ts`       | One-way import of the legacy Hub's public content                              | dry run; `--apply`                           |
| `setup/import-legacy-members.ts`       | One-way import of legacy member data                                           | dry run; `--apply`                           |
| `setup/generate-vapid-keys.mjs`        | Prints a Web Push VAPID key pair                                               | no                                           |

`lib/accountSpec.ts` is the shared account-provisioning helper used by scripts and test fixtures.
