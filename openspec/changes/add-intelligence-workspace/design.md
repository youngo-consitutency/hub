# Design: Hub Intelligence

## Trust boundaries

1. `public` indexes only records already exposed by public Hub APIs.
2. `member` adds the signed-in actor's own role and assignments.
3. `mandate` adds directory contact channels only when `intelligence.contacts.read` is derived from an existing mandate-holder capability.
4. `operations` is available to admins and adds operational scope, never raw account/message data.

Authorization is evaluated inside YOUNGO Hub for every query. The central GYC intelligence fabric may plan a call but cannot grant Hub access.

## Retrieval

Records are normalized into stable `youngo-hub:<type>:<hash>` envelopes. Four inspectable lists—phrase, token coverage, inverse document frequency, and title match—are fused with reciprocal-rank fusion (`k=60`). The response exposes scores and contributing signals.

## Synthesis

Synthesis is deterministic and extractive. Every bullet carries one or more evidence indexes, citations resolve to Hub routes, and every response includes an uncertainty/verification warning. An LLM is not required for correctness.

## Writeback

The only allowlisted action is `save_research_note`. It requires:

- at least one stable evidence citation;
- an idempotency key;
- proposal by a verified member;
- approval by an admin other than the proposer;
- a separate apply call after approval.

Application writes only to `intelligence_notes`; it cannot mutate events, decisions, memberships, messages, or submissions.

## Observability

Authenticated query text is held in the dedicated `intelligence_queries` table. Unauthenticated public queries are stored only as fingerprints. The general audit stores only a query fingerprint, audience, result count, actor, and request ID. Writeback transitions are recorded in the governance audit. Admin metrics report volume and writeback states without exposing query content.
