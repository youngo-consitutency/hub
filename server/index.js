import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicRouter } from './routes/public.js'
import { icsRouter } from './routes/ics.js'
import { authRouter } from './routes/auth.js'
import { memberRouter } from './routes/member.js'
import { intelligenceRouter } from './routes/intelligence.js'
import { pushRouter } from './routes/push.js'
import { requestSecurity } from './lib/security.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = express()
// argv port wins (dev-all pins 8787 so an injected PORT can't steal it from Vite);
// otherwise PORT (Railway single-process production), else 8787.
const PORT = process.argv[2] || process.env.PORT || 8787

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(requestSecurity)
const allowedOrigin = process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true)
app.use(cors({ origin: allowedOrigin, credentials: true }))
app.use(express.json({ limit: '256kb' }))

app.get('/healthz', (req, res) => {
  res.json({ ok: true, db: process.env.DATABASE_URL ? 'postgres' : 'fixtures', version: '0.1.0' })
})

// Public GET caching per 04 §1
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  next()
})
app.use('/api/auth', authRouter)
app.use('/api/member', memberRouter)
app.use('/api/intelligence', intelligenceRouter)
app.use('/api/push', pushRouter)
app.use('/api', publicRouter)
app.use('/ics', icsRouter)

const dist = path.join(here, '../dist')
app.use(express.static(dist))
app.get(/^\/(?!api|ics|og|healthz).*/, (req, res, next) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => (err ? next() : undefined))
})

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err)
  res.status(500).json({ error: { code: 'server_error', message: 'Something broke — try again.' } })
})

app.listen(PORT, () => {
  console.log(`youngo-hub api listening on :${PORT} (${process.env.DATABASE_URL ? 'postgres' : 'fixture'} mode)`)
})
