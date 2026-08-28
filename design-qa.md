# Design QA — Calendar agenda structure

- Source visual truth: the user-provided Calendar agenda screenshot, reproduced at the same live route/state in `docs/design-qa/2026-08-28-calendar-agenda/before-desktop.png`
- Implementation: `docs/design-qa/2026-08-28-calendar-agenda/after-desktop-viewport.png`
- Responsive implementation: `docs/design-qa/2026-08-28-calendar-agenda/after-mobile-viewport.png`
- Full-view comparison: `docs/design-qa/2026-08-28-calendar-agenda/comparison-full.png`
- Focused comparison: `docs/design-qa/2026-08-28-calendar-agenda/comparison-focused.png`
- Route/state: `/calendar`, August 2026, all event types, Month agenda range
- Desktop source and implementation: 2318 x 1329 CSS px and image px at device scale 1.
- Mobile implementation: 390 x 844 CSS px and image px at device scale 1.

## Full-view and focused comparison

The focused comparison places the original unstructured month rail beside the rebuilt agenda. The implementation preserves the same panel, EventCard language, typography, tokens, and month-calendar relationship while adding a compact Today / This week / Month range control and explicit date groups. Cards use natural content height instead of four forced slots, and the visible scrollbar now leads to a padded final position where the last card is fully visible with its bottom border intact.

The full view confirms that the month grid, event-type filters, navigation, legend, and surrounding page composition are unchanged. At 390px the two Calendar regions stack, the range control fits without document overflow, all date groups expand naturally, and the final card remains inside the agenda surface.

## Required fidelity surfaces

- Fonts and typography: retained the Hub system stack, weights, sizes, and card hierarchy; new date labels use the existing compact uppercase section language without truncating event titles.
- Spacing and layout rhythm: agenda header, range switch, date groups, and natural cards use shared spacing tokens; desktop retains the calendar-matched rail and mobile returns to document flow.
- Colors and tokens: all surfaces, active range state, borders, shadows, and text colors reuse existing Hub tokens.
- Image and icon quality: no raster assets were needed; all new range cues use the established outlined Tabler family.
- Copy and content: event titles, types, working groups, and UTC/local times are unchanged. Added only Agenda, Today, This week, Month, date-group counts, and scoped empty-state copy.

## Findings and comparison history

1. Initial P2: the right rail presented one undifferentiated month list, forced every card into one of four oversized slots, and clipped the visible bottom card against the fixed panel edge.
2. Fix: introduced functional range controls, grouped results by UTC date, returned EventCard to natural height, changed mandatory per-card snapping to group-level proximity, and added real scroll-end padding and card containment.
3. Post-fix evidence: Month shows seven dated groups and nine events; This week shows five events across four dates; Today produces the correct empty state; selecting 30 August shows two events plus a clear action. At maximum scroll, the last card bottom is 12px above the list bottom with its 1px border visible. No actionable P0, P1, or P2 finding remains.

## Interaction and runtime checks

- Today, This week, and Month update pressed state and agenda results.
- Selecting a populated calendar day opens that day's group; Clear selected day restores Month.
- Event-type filters remain independent of agenda range.
- Desktop and 390px document overflow: none.
- Browser error/warning log after the interaction pass: empty.
- Full `npm run check`: passed (228 tests passed, 2 PostgreSQL-only tests skipped; content, format, lint, and build passed).

final result: passed
