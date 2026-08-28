# Mobile layout audit — 2026-08-28

## Scope

- Authenticated Hub at 390 px and 320 px widths.
- Catalogue, detail, calendar, account, onboarding, library, search, Council, COY, directory, recognition, and help routes.
- Source captures: `docs/mobile-audit/2026-08-28-before/`.
- Post-fix captures: `docs/mobile-audit/2026-08-28-after/`.

## Findings and fixes

1. The fixed bottom navigation duplicated the header Menu action and placed Home at the edge.
   - Replaced Menu with Opportunities, shown compactly as `Calls`.
   - Ordered the verified-member shortcuts as Calendar, Calls, Home, Groups, Profile.
   - Kept the complete navigation in the header menu and fixed the modal boundary so that header button can close it.
2. Catalogue filters consumed most of the first mobile viewport.
   - Kept each labelled filter family on one horizontally scrollable pill row.
   - Preserved every filter and its accessible name while exposing results much earlier.
   - Removed stretched sort-control tracks and hid native scrollbars while retaining clipped-next-item affordance.
3. Narrow-page gutters and touch controls were inconsistent.
   - Reduced the page gutter from 16 px to 12 px below 420 px.
   - Raised shared icon controls to a 44 px touch target on mobile.
   - Kept calendar navigation from shrinking below its intended target.
4. Profile actions wasted vertical space at 320 px.
   - Grouped photo and sign-out actions into one compact row with the file guidance beneath.

## Verification

- Swept 17 authenticated routes at 390 px and 320 px (34 states total).
- No document-level horizontal overflow was found.
- Verified the header menu opens and closes, locks the main content and bottom navigation while open, and restores the page afterward.
- Verified the Calls shortcut routes to `/opportunities` and becomes the active bottom-nav item.
- Verified Home is the third of five shortcuts.
- Verified 44 px mobile targets for profile notification help and shared icon buttons.
- Compared matched viewport captures for Opportunities, Working groups, and Profile before and after the fixes.

## Residual limits

- This is a rendered responsive-layout audit, not a claim of complete accessibility conformance.
- Dynamic loading, empty, validation-error, and staff-only states were not exhaustively captured at every breakpoint.

