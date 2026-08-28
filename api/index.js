import { createApp } from '../server/app.js'
import { initializeContentWorkflow } from '../server/lib/contentWorkflow.js'

// The consultation deployment deliberately exposes the current Hub as a
// read-only preview until it has a dedicated PostgreSQL database. This avoids
// presenting serverless fixture writes as durable member data.
process.env.READ_ONLY_PREVIEW ||= '1'

await initializeContentWorkflow()

export default createApp()
