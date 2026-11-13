// regenerates the community illustrations: Open Peeps art (CC0, Pablo Stanley) via DiceBear (MIT)
import { mkdir, writeFile } from 'node:fs/promises'
import { createAvatar } from '@dicebear/core'
import * as openPeeps from '@dicebear/open-peeps'

const seeds = ['amara', 'jun', 'lucia', 'tariq', 'ingrid', 'kofi', 'mei', 'noor']
const out = 'public/illustrations/community'
await mkdir(out, { recursive: true })
for (const seed of seeds)
  await writeFile(
    `${out}/${seed}.svg`,
    createAvatar(openPeeps, { seed, backgroundColor: ['transparent'] }).toString(),
  )
