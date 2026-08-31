# Tasks

- [x] Define email categories, privacy boundaries, and delivery invariants.
- [x] Add notification preferences, outbox, delivery attempts, and suppressions migration.
- [x] Add PostgreSQL and fixture-mode notification stores.
- [x] Add Nodemailer SMTP transport and MJML templates.
- [x] Add signed category-specific one-click unsubscribe.
- [x] Add member preference API and Profile controls.
- [x] Add throttled, leased worker and retry behavior.
- [x] Connect password-reset delivery without persisting raw reset URLs.
- [x] Add source-authorized and audited admin broadcast enqueueing.
- [x] Add privacy, authorization, deduplication, throttling, and delivery tests.
- [ ] Select the SMTP relay, add it to the Privacy Notice processors, describe
      notification preferences and suppression data, bump the notice version,
      and obtain the required governance approval.
- [ ] Configure SPF, DKIM, DMARC, a custom return path, provider webhooks, and a
      staging recipient allowlist.
- [x] Run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Deploy to YOUNGO Hub staging and inspect authentication, bounces, and reputation before production.
