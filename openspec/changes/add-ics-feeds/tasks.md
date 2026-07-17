# Tasks — add-ics-feeds

## 1. Server
- [x] 1.1 `server/lib/ics.js` — pure VCALENDAR/VEVENT builder (icsDate, escapeText,
      foldLine, buildCalendar) with a `-PT15M` VALARM
- [x] 1.2 `store.listEventsForIcs({ type, wg }, now, days)` — 90-day forward window
- [x] 1.3 `server/routes/ics.js` — all / type / wg / single-event, `text/calendar`,
      `Cache-Control: public, max-age=900`, 404 on unknown WG/event
- [x] 1.4 Mount `/ics` in `server/index.js` (SPA catch-all already excludes it)

## 2. Client
- [x] 2.1 `components/Subscribe.jsx` — CopyFeedButton + CalendarSubscribe panel
- [x] 2.2 Calendar header "Subscribe" (all + current filter, copy URLs + how-to)
- [x] 2.3 Event detail "Add to calendar" single-event download (hidden once concluded)
- [x] 2.4 WG page "Subscribe to this WG" feed

## 3. Quality
- [x] 3.1 `tests/ics.test.js` — date format, escaping, folding, CRLF, VALARM, URL omission
- [x] 3.2 eslint clean; endpoints verified (headers, filters, 404, Vite proxy)

## Deferred
- [ ] Per-user token feed `/ics/me/:token.ics` (needs add-members-auth, P2)
- [ ] RRULE occurrence expansion (with admin/Postgres path per 04 §recurrence)
