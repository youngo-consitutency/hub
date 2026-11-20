// vercel runs this instead of `build`: production migrates first and aborts on failure;
// previews migrate only when HUB_MIGRATE_PREVIEW=1 is set on the Preview environment (its own database)
import { spawnSync } from 'node:child_process'

const run = (script) => {
  const { status } = spawnSync('npm', ['run', script], { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}

const { VERCEL_ENV, HUB_MIGRATE_PREVIEW } = process.env
if (VERCEL_ENV === 'production' || (VERCEL_ENV === 'preview' && HUB_MIGRATE_PREVIEW === '1'))
  run('migrate')
run('build')
