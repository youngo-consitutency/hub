# Agent access to Hub information

Use this when an agent should **add or update Hub information** — opportunities,
resources, events, announcements — without a code deploy. The Hub already stores
that content. The MCP signs in as a YOUNGO Hub account and calls the same APIs
the website uses.

It does **not** replace YOUNGO’s own engagement. It publishes information
members can look up.

Do not give agents `DATABASE_URL`. The owner connection can read password
hashes and personal account fields. This MCP never opens the database.

## 1. Credentials

Use a real Hub account whose role matches the work:

| Work                                   | Account                                          |
| -------------------------------------- | ------------------------------------------------ |
| Post an opportunity, training, or call | Organisation / NGO seat that can manage requests |
| Suggest a science resource             | Any verified member                              |
| Draft events or announcements          | Content editor (or admin)                        |
| Approve/publish governed content       | Content reviewer / publisher (or admin)          |
| Approve organisation postings          | Admin or Membership Team                         |

Create the account in the Hub (or seed a demo account), then put its email and
password in the agent environment. Prefer a dedicated organisation or content
seat, not a personal admin login, when you can.

```bash
export HUB_ORIGIN="https://youngohub.org"   # default
export HUB_EMAIL="content-bot@example.org"
export HUB_PASSWORD="..."
# Optional, instead of email/password:
# export HUB_TOKEN="..."
```

Never commit the password. For Cursor, store it in the user environment so
`${env:HUB_PASSWORD}` resolves at launch.

## 2. Point Cursor (or Grok) at the MCP

Project config is at `.cursor/mcp.json`. Add:

```json
{
  "mcpServers": {
    "youngo-hub-content": {
      "command": "node",
      "args": ["${workspaceFolder}/scripts/agent/hub-content-mcp.mjs"],
      "env": {
        "HUB_ORIGIN": "https://youngohub.org",
        "HUB_EMAIL": "${env:HUB_EMAIL}",
        "HUB_PASSWORD": "${env:HUB_PASSWORD}"
      }
    }
  }
}
```

Reload MCP servers after setting the variables. Run locally with:

```bash
node scripts/agent/hub-content-mcp.mjs
```

## 3. Tools

- `whoami` — what this account is allowed to do
- `catalog_options` — closed lists (kinds, formats, resource topics)
- `list_opportunities` / `create_opportunity` / `list_org_opportunities` / `withdraw_opportunity`
- `list_opportunity_review` / `review_opportunity` — Membership Team / admin
- `submit_resource` / `list_my_resource_submissions`
- `list_content` / `create_content_draft` / `submit_content_draft` / `review_content_draft` / `publish_content_draft`

Postings and resources still go through the Hub’s review rules. The first
opportunity from an organisation is held for review. Events and announcements
are not live until someone with publish permission publishes the approved draft.

## 4. What an agent should and should not do

- **Do** add opportunities, resources, and drafts when a person has asked for
  that information to be findable on the Hub.
- **Do** call `whoami` and `catalog_options` before posting, so kinds and
  regions match what the Hub accepts.
- **Do not** treat the Hub as YOUNGO itself. Copy should point members to the
  constituency’s own processes, not invent a parallel one.
- **Do not** skip review by writing to the database.
- **Do not** join content back to personal account fields the APIs do not
  return. AGENTS.md still forbids exposing credentials, sessions, guardian
  data, and personal contact fields.
