## ADDED Requirements

### Requirement: DMP decision tracking
The system SHALL track constituency decisions as title, summary, proposal link, proposer, status ∈ `proposed → open_for_input → objection_window → adopted | not_adopted | withdrawn`, input/objection deadlines, "how to respond" note, and outcome record.

#### Scenario: Member catches an objection window
- **WHEN** a decision is in `objection_window` with a future deadline
- **THEN** it renders in Council "In progress" with a countdown chip and is eligible for the home feed's closing-soon section

#### Scenario: Outcome archived
- **WHEN** a decision has an outcome status
- **THEN** it renders under "Decided" with outcome chip, decision date, and final text link

### Requirement: Public process timeline
Every status transition SHALL be recorded (status, note, timestamp) and rendered on the decision page — process visible, not just outcome. All Council content is public-read.

#### Scenario: Timeline shows the path
- **WHEN** a member opens a decided decision
- **THEN** they see each stage with dates and facilitator notes
