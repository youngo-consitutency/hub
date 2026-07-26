import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { publicRouter } from '../server/routes/public.js'
import { icsRouter } from '../server/routes/ics.js'

async function withServer(run) {
  const app = express()
  app.use(express.json())
  app.use('/api', publicRouter)
  app.use('/ics', icsRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    )
  }
}

test('anonymous JSON routes omit private meeting and WG channel links', async () => {
  await withServer(async (origin) => {
    const events = await fetch(`${origin}/api/events`).then((res) => res.json())
    assert.ok(events.items.length > 0)
    assert.ok(
      events.items.every((event) => !Object.hasOwn(event, 'meetingUrl')),
    )

    const groups = await fetch(`${origin}/api/groups`).then((res) => res.json())
    assert.ok(groups.items.length > 0)
    assert.ok(
      groups.items.every(
        (group) =>
          !Object.hasOwn(group, 'whatsappUrl') &&
          !Object.hasOwn(group, 'groupUrl') &&
          !Object.hasOwn(group, 'driveUrl'),
      ),
    )
  })
})

test('anonymous ICS routes omit private meeting URLs', async () => {
  await withServer(async (origin) => {
    const calendar = await fetch(`${origin}/ics/all.ics`).then((res) =>
      res.text(),
    )
    assert.doesNotMatch(calendar, /https?:\/\/(?:meet|zoom|teams)\./i)
    assert.doesNotMatch(calendar, /^URL:/m)
  })
})
