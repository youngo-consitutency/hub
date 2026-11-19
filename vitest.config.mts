import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // unit specs need nothing running; int specs need the dev server and a local database
    include: ['tests/unit/**/*.spec.ts', 'tests/int/**/*.int.spec.ts'],
    // Specs share one database and one dev server — run files sequentially
    // so cross-file fixtures (working groups, provisioned accounts) cannot race.
    fileParallelism: false,
    // Network-backed dev databases make each request several round trips.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
