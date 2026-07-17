## ADDED Requirements

### Requirement: Role-first directory (guest scope)
The directory SHALL list roles grouped as focal points, WG contacts, liaisons, and operations with descriptions and a generic contact email; personal names and handles SHALL NOT be present in the guest payload (server-stripped, not CSS-hidden) until members auth ships.

#### Scenario: Scrape protection
- **WHEN** a logged-out visitor loads the directory API
- **THEN** the response contains role titles, descriptions, and generic emails only
