import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const strip = (sql: string) =>
  spawnSync('awk', ['-f', 'scripts/ops/strip-pg-attver.awk'], { input: sql, encoding: 'utf8' })
    .stdout

describe('strip-pg-attver.awk', () => {
  it('removes the Supabase-only column options', () => {
    const sql =
      'CREATE TABLE public.t (a integer);\nALTER TABLE ONLY public.t ALTER COLUMN a SET (pg_attver=67483544);\nSELECT 1;\n'
    expect(strip(sql)).toBe('CREATE TABLE public.t (a integer);\nSELECT 1;\n')
  })

  it('keeps every data row, even one that looks like the statement', () => {
    const row = 'ALTER TABLE ONLY public.t ALTER COLUMN a SET (pg_attver=1);'
    const sql = `COPY public.t (note) FROM stdin;\n${row}\nplain\n\\.\nALTER TABLE ONLY public.t ALTER COLUMN a SET (pg_attver=2);\n`
    expect(strip(sql)).toBe(`COPY public.t (note) FROM stdin;\n${row}\nplain\n\\.\n`)
  })
})
