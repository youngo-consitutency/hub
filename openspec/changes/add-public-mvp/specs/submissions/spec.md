## ADDED Requirements

### Requirement: Submission lifecycle tracking
Each UNFCCC call for input SHALL be tracked as title, official reference link, deadline (UTC), bottom-lining WG, status ∈ `open → drafting → internal_review → submitted → archived`, draft link, and a "how to contribute" note.

#### Scenario: Member finds a way in
- **WHEN** a member opens the submissions view
- **THEN** open items list soonest-deadline-first with countdown chips and WG tags

#### Scenario: Institutional memory
- **WHEN** a submission is `submitted` or `archived`
- **THEN** it appears in the Archive view grouped by year with its final text link, without countdowns

### Requirement: Deadline urgency signals
Submission cards SHALL render countdown chips with thresholds >7d neutral, ≤7d warning, ≤48h danger.

#### Scenario: Two-day deadline
- **WHEN** a deadline is 40 hours away
- **THEN** the chip renders in the danger tone
