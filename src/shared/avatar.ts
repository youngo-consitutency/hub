import { createAvatar } from '@dicebear/core'
import * as openPeeps from '@dicebear/open-peeps'

// Member avatars are built, never uploaded: a profile stores a few picks from
// the Open Peeps style's own option lists and the drawing comes from the
// library, so there is nothing to moderate.

const NONE = 'none'
const properties = openPeeps.schema.properties as Record<
  string,
  { items?: { enum?: string[] }; default?: string[] }
>
const parts = (key: string) => properties[key]?.items?.enum ?? []
const palette = (key: string) => properties[key]?.default ?? []

/** Every value a member may store, per option. Anything else is rejected. */
export const AVATAR_CHOICES = {
  head: parts('head'),
  face: parts('face'),
  facialHair: [NONE, ...parts('facialHair')],
  accessories: [NONE, ...parts('accessories')],
  mask: [NONE, ...parts('mask')],
  skinColor: palette('skinColor'),
  headContrastColor: palette('headContrastColor'),
  clothingColor: palette('clothingColor'),
} satisfies Record<string, string[]>

export type AvatarKey = keyof typeof AVATAR_CHOICES
export type AvatarOptions = Partial<Record<AvatarKey, string>>

export const AVATAR_KEYS = Object.keys(AVATAR_CHOICES) as AvatarKey[]

// the style draws these by chance; a pick switches the chance to all or nothing
const OPTIONAL: AvatarKey[] = ['facialHair', 'accessories', 'mask']

/** Keeps only allowlisted picks, so nothing else ever reaches the renderer. */
export function cleanAvatar(input: unknown): AvatarOptions {
  const out: AvatarOptions = {}
  if (!input || typeof input !== 'object') return out
  for (const key of AVATAR_KEYS) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === 'string' && AVATAR_CHOICES[key].includes(value)) out[key] = value
  }
  return out
}

// the seed fills every option the member has not picked, so the same member
// gets the same avatar everywhere and nobody is left without one
function draw(seed: string | number, options?: unknown) {
  const styleOptions: Record<string, unknown> = { seed: String(seed) }
  for (const [key, value] of Object.entries(cleanAvatar(options))) {
    if (OPTIONAL.includes(key as AvatarKey)) {
      styleOptions[`${key}Probability`] = value === NONE ? 0 : 100
    }
    if (value !== NONE) styleOptions[key] = [value]
  }
  return createAvatar(openPeeps, styleOptions)
}

export const avatarDataUri = (seed: string | number, options?: unknown) =>
  draw(seed, options).toDataUri()

/** What is drawn for this member: their picks over the seeded defaults. */
export function resolveAvatar(seed: string | number, options?: unknown) {
  const drawn = draw(seed, options).toJson().extra as Record<string, unknown>
  return Object.fromEntries(
    AVATAR_KEYS.map((key) => [key, String(drawn[key] ?? NONE).replace('#', '')]),
  ) as Record<AvatarKey, string>
}

// a random seed rather than a random pick per option, so the style's own
// odds apply and most avatars come out without a mask or a moustache
export const randomAvatar = (): AvatarOptions => resolveAvatar(Math.random().toString(36).slice(2))
