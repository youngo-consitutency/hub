# Scripts

Run from the repository root. Anything that writes reads `DATABASE_URL` from `.env.local`, so check which database it names first. Agents never run writing scripts against production; a maintainer does.

| Script                                 | Purpose                                                           | Writes?                         |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| `ci/vercel-build.mjs`                  | Vercel build: migrates production first, skips previews           | production only, on deploy      |
| `ci/smoke.ts`                          | Pre-production smoke check against a started server               | no                              |
| `ci/mcp-smoke.mjs`                     | CI handshake check for `mcp-content`                              | no                              |
| `agent/hub-mcp.mjs`                    | Stdio MCP for local agents (content tools plus session memory)    | Hub API only                    |
| `agent/sync-mcp.mjs`                   | Renders the MCP config for each tool (`npm run sync:mcp`)         | local config files              |
| `assets/*.mjs`                         | Regenerate brand, icon and illustration assets                    | `public/`                       |
| `ops/check-resource-links.ts`          | Probes resource URLs and files broken-link issues                 | dry run; `--apply` files issues |
| `setup/add-page-headings.ts`           | Fills missing About and Our work headings                         | dry run; `--apply`              |
| `setup/remove-x-link.ts`               | Drops the X link from the `connect` document                      | dry run; `--apply`              |
| `setup/remove-consultation-content.ts` | Removes the retired consultation banner, footer link and document | dry run; `--apply`              |
| `setup/grant-authority.ts`             | Last-resort authority grant (see AGENTS.md, Operator recovery)    | writes at once                  |
| `setup/map-directory-roles.ts`         | Gives focal point directory rows the `focal_point` role           | writes at once                  |
| `setup/import-legacy-content.ts`       | One-way import of the legacy Hub's public content                 | writes unless `DRY_RUN=1`       |
| `setup/import-legacy-members.ts`       | One-way import of legacy member data                              | writes unless `DRY_RUN=1`       |
| `setup/generate-vapid-keys.mjs`        | Prints a Web Push VAPID key pair                                  | no                              |

`lib/accountSpec.ts` is the shared account-provisioning helper used by scripts and test fixtures.
