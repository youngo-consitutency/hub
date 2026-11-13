// regenerates the hero figures: Lorelei portraits by Lisa Wischofsky (CC0) via DiceBear (MIT).
// each figure is fixed by hand (skin, hair, a friendly mouth, no random grimaces) so the set is
// diverse and every portrait looks approachable
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createAvatar } from '@dicebear/core'
import * as lorelei from '@dicebear/lorelei'

const friendly = ['happy01', 'happy02', 'happy03', 'happy04', 'happy05', 'happy06']
const figures = {
  amara: {
    skinColor: ['8d5a3d'],
    hairColor: ['1f1612'],
    hair: ['variant12'],
    glasses: ['variant02'],
    glassesProbability: 100,
  },
  jun: { skinColor: ['f2c9a5'], hairColor: ['15110e'], hair: ['variant20'], beardProbability: 0 },
  lucia: {
    skinColor: ['d49a74'],
    hairColor: ['5b3720'],
    hair: ['variant28'],
    earringsProbability: 100,
    earrings: ['variant01'],
  },
  tariq: {
    skinColor: ['a26b47'],
    hairColor: ['111111'],
    hair: ['variant05'],
    beard: ['variant01'],
    beardProbability: 100,
  },
  ingrid: {
    skinColor: ['f7d8c0'],
    hairColor: ['d9b36a'],
    hair: ['variant41'],
    frecklesProbability: 100,
    freckles: ['variant01'],
  },
  kofi: {
    skinColor: ['5a3825'],
    hairColor: ['0d0d0d'],
    hair: ['variant09'],
    glasses: ['variant04'],
    glassesProbability: 100,
  },
}

const out = 'public/illustrations/community'
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
for (const [name, options] of Object.entries(figures))
  await writeFile(
    `${out}/${name}.svg`,
    createAvatar(lorelei, {
      seed: name,
      mouth: friendly,
      eyes: ['variant01', 'variant02', 'variant03', 'variant05'],
      eyebrows: ['variant01', 'variant02', 'variant03'],
      backgroundColor: ['transparent'],
      beardProbability: 0,
      glassesProbability: 0,
      earringsProbability: 0,
      frecklesProbability: 0,
      hairAccessoriesProbability: 0,
      ...options,
    }).toString(),
  )
