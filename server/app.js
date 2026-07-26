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
import { appOrigin } from './lib/config.js'
import { requestSecurity } from './lib/security.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultDist = path.join(here, '../dist')

// Express recognises an error handler by its four-argument signature.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'invalid_json',
        message: 'Request body must contain valid JSON.',
      },
    })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'payload_too_large',
        message: 'Request body is too large.',
      },
    })
  }

  console.error(err)
  return res.status(500).json({
    error: {
      code: 'server_error',
      message: 'Something went wrong. Please try again.',
    },
  })
}

export function createApp({ env = process.env, dist = defaultDist } = {}) {
  const app = express()

  app.disable('x-powered-by')
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1)
  app.use(requestSecurity)
  app.use(
    cors({
      origin: env.APP_ORIGIN ? appOrigin(env) : true,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '256kb' }))

  app.get('/healthz', (req, res) => {
    res.json({
      ok: true,
      db: env.DATABASE_URL ? 'postgres' : 'fixtures',
      version: '0.1.0',
    })
  })

  app.use('/api', (req, res, next) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    }
    next()
  })
  app.use('/api/auth', authRouter)
  app.use('/api/member', memberRouter)
  app.use('/api/intelligence', intelligenceRouter)
  app.use('/api/push', pushRouter)
  app.use('/api', publicRouter)
  app.use('/ics', icsRouter)

  app.use(express.static(dist))
  app.get(/^\/(?!api|ics|og|healthz).*/, (req, res, next) => {
    res.sendFile(path.join(dist, 'index.html'), (err) =>
      err ? next() : undefined,
    )
  })

  app.use(errorHandler)
  return app
}
