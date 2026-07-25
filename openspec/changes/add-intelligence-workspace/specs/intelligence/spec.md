# Hub Intelligence specification

## Requirement: public evidence adapter

The system SHALL expose a rate-limited public query endpoint over explicitly public events, submissions, Council decisions, approved COYs, working groups, public directory fields, and Global Youth Statement material.

### Scenario: public query

- WHEN an unauthenticated caller submits a valid question to `/api/intelligence/public/query`
- THEN the system returns only public evidence envelopes, citations, field-policy information, and extractive synthesis.

## Requirement: source-side private authorization

The system SHALL authenticate and resolve capabilities before adding any non-public evidence.

### Scenario: unauthenticated private query

- WHEN a caller submits to `/api/intelligence/query` without a valid Hub session
- THEN the system responds `401` and performs no retrieval.

### Scenario: ordinary verified member

- WHEN a verified member queries Hub Intelligence
- THEN results may contain public evidence and that actor's own role/assignment context
- AND SHALL NOT contain another member's contact channel, raw account, private message, credential, session, guardian, or minority data.

### Scenario: mandate holder

- WHEN an actor has `intelligence.contacts.read`
- THEN member directory contact evidence may be retrieved at `mandate` audience.

## Requirement: inspectable synthesis

Every synthesized bullet SHALL cite stable evidence IDs, expose supporting records, and include a verification caveat.

## Requirement: controlled writeback

Only `save_research_note` SHALL be allowed. A writeback SHALL require citations, idempotency, independent admin approval, and a separate application step. It SHALL NOT modify operational source records.

## Requirement: observability

Private queries and all writeback transitions SHALL be auditable. General governance audit entries SHALL use a query fingerprint instead of copying query text.
