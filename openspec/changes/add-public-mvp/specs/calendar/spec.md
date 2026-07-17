## ADDED Requirements

### Requirement: Unified filterable agenda
The calendar SHALL list all events grouped by day with filter pills for type (All, Constituency, Working groups, Forums, UNFCCC, Webinars).

#### Scenario: Filter narrows the agenda
- **WHEN** a user selects the "Working groups" pill
- **THEN** only wg_call events render, still grouped by day

### Requirement: Dual timezone display
Every event time SHALL display in UTC and the viewer's local timezone using the canonical format `Wed 15 Jul · 13:00 UTC · 16:00 EAT`.

#### Scenario: Local equals UTC
- **WHEN** the viewer's zone is UTC
- **THEN** the time renders once as `13:00 UTC`
