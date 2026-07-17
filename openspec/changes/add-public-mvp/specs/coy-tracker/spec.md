## ADDED Requirements

### Requirement: COY registry
The system SHALL list LCOYs, RCOYs, and the global COY with type, location, region, dates (month precision allowed), status ∈ `announced / applications_open / registration_open / concluded / cancelled`, links, and organizer contact.

#### Scenario: Regional filter
- **WHEN** a member filters by type and region
- **THEN** the filters compose and results sort status-priority first (registration open → applications open → announced → concluded), then by date

#### Scenario: Unapproved entries hidden
- **WHEN** a COY row is not review-approved
- **THEN** it never renders publicly
