import { createApp } from './app.js'
import { validateRuntimeConfig } from './lib/config.js'

validateRuntimeConfig()
// argv port wins (dev-all pins 8787 so an injected PORT can't steal it from Vite);
// otherwise PORT (Railway single-process production), else 8787.
const PORT = process.argv[2] || process.env.PORT || 8787
const app = createApp()

app.listen(PORT, () => {
  console.log(`youngo-hub api listening on :${PORT} (${process.env.DATABASE_URL ? 'postgres' : 'fixture'} mode)`)
})
