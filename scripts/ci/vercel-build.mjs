// vercel runs this instead of `build`: production migrates first and aborts on failure; previews skip migrations
import { spawnSync } from 'node:child_process'

const run = (script) => {
  const { status } = spawnSync('npm', ['run', script], { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}

if (process.env.VERCEL_ENV === 'production') run('migrate')
run('build')
