import { Router } from 'express'
import * as store from '../lib/store.js'
import { buildCalendar } from '../lib/ics.js'
import { eventView } from '../lib/publicViews.js'

export const icsRouter = Router()

const TYPE_LABEL = {
  constituency_call: 'Constituency calls', wg_call: 'Working group calls', wgf: 'WG forums',
  unfccc_session: 'UNFCCC sessions', webinar: 'Webinars', coordination: 'Coordination',
}

// Params carry the ".ics" extension (calendar apps key on it); strip it to get the id.
const stripIcs = (file) => file.replace(/\.ics$/, '')

function send(res, filename, body) {
  res.set('Content-Type', 'text/calendar; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=900') // 04 §1
  res.set('Content-Disposition', `inline; filename="${filename}"`)
  res.send(body)
}

icsRouter.get('/all.ics', (req, res) => {
  const events = store.listEventsForIcs().map((event) => eventView(event))
  send(res, 'youngo-all.ics', buildCalendar({ name: 'YOUNGO — All events', events }))
})

icsRouter.get('/type/:file', (req, res) => {
  const type = stripIcs(req.params.file)
  const events = store.listEventsForIcs({ type }).map((event) => eventView(event))
  send(res, `youngo-${type}.ics`, buildCalendar({ name: `YOUNGO — ${TYPE_LABEL[type] || type}`, events }))
})

icsRouter.get('/wg/:file', (req, res) => {
  const slug = stripIcs(req.params.file)
  const group = store.getGroup(slug)
  if (!group) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown working group' } })
  const events = store.listEventsForIcs({ wg: slug }).map((event) => eventView(event))
  send(res, `youngo-${slug}.ics`, buildCalendar({ name: `YOUNGO — ${group.name} WG`, events }))
})

icsRouter.get('/event/:file', (req, res) => {
  const slug = stripIcs(req.params.file)
  const event = store.getEvent(slug)
  if (!event) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown event' } })
  send(res, `${slug}.ics`, buildCalendar({ name: event.title, events: [eventView(event)] }))
})
