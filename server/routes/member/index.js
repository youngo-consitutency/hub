// Authenticated member API. Routes are grouped by the audience they serve —
// each module owns its own guards and mounts at the same base path, so the
// public surface is unchanged from when this lived in a single file.
import { Router } from 'express'
import { router as core } from './core.js'
import { router as people } from './people.js'
import { router as wg } from './wg.js'
import { router as ngo } from './ngo.js'
import { router as points } from './points.js'
import { router as teams } from './teams.js'
import { router as content } from './content.js'
import { router as feedback } from './feedback.js'
import { router as opportunities } from './opportunities.js'
import { router as admin } from './admin.js'
import { router as resources } from './resources.js'

export const memberRouter = Router()

// Nothing behind /api/member is cacheable: every response is account-specific.
memberRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// Mount order matches the original file so route precedence cannot shift.
memberRouter.use(core)
memberRouter.use(people)
memberRouter.use(wg)
memberRouter.use(ngo)
memberRouter.use(points)
memberRouter.use(teams)
memberRouter.use(content)
memberRouter.use(resources)
memberRouter.use(feedback)
memberRouter.use(opportunities)
memberRouter.use(admin)
