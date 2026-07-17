## ADDED Requirements

### Requirement: Urgency-sorted feed
The home screen SHALL show a single feed combining pinned announcements, submission and DMP-decision deadlines within 14 days, this week's meetings, and upcoming COYs, ordered by urgency, with pinned announcements always on top.

#### Scenario: Deadline floats up
- **WHEN** a deadline moves within 48 hours
- **THEN** its card appears in the closing-soon section with the danger countdown chip

#### Scenario: Live meeting takes over
- **WHEN** an event's start ≤ now < end
- **THEN** the feed shows a live banner at the very top with a Join button linking the meeting URL

#### Scenario: Sections fail independently
- **WHEN** one feed section's data fails to load
- **THEN** that section renders an inline retry card and all other sections render normally
