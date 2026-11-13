// vercel runs this instead of `build`. production migrates first so code never
// ships ahead of its schema, and a failed migration aborts the deploy (the live
// one keeps serving). previews skip it: their env can share a database, and an
// unmerged pr's migrations must never reach it
import { spawnSync } from 'node:child_process'

const run = (script) => {
  const { status } = spawnSync('npm', ['run', script], { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}

if (process.env.VERCEL_ENV === 'production') run('migrate')
run('build')
