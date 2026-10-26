import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

import {
  THEME_STORAGE_KEY,
  chooseTheme,
  themePreference,
  watchSystemTheme,
} from '../../src/member/lib/theme'

function fakeRoot() {
  return { dataset: {} as Record<string, string>, ownerDocument: null }
}
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => void (data[key] = value),
  }
}
function fakeMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  return {
    matches,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    listeners,
  }
}
function fakeEvents() {
  const listeners = new Set<(event: { key: string | null }) => void>()
  return {
    addEventListener: (_: string, fn: AnyFn) => listeners.add(fn),
    removeEventListener: (_: string, fn: AnyFn) => listeners.delete(fn),
    fire: (key: string | null) => listeners.forEach((fn) => fn({ key })),
    listeners,
  }
}
type AnyFn = (event: { key: string | null }) => void

describe('theme', () => {
  it('follows the device until a choice is saved', () => {
    const root = fakeRoot()
    const storage = fakeStorage()
    watchSystemTheme({ root, media: fakeMedia(true), storage, events: fakeEvents() } as never)
    expect(root.dataset.theme).toBe('dark')
    chooseTheme('light', { root, storage } as never)
    expect(root.dataset.theme).toBe('light')
    expect(themePreference(storage)).toBe('light')
  })

  it('syncs a choice made in another tab', () => {
    const root = fakeRoot()
    const storage = fakeStorage()
    const events = fakeEvents()
    watchSystemTheme({ root, media: fakeMedia(false), storage, events } as never)
    storage.setItem(THEME_STORAGE_KEY, 'dark')
    events.fire(THEME_STORAGE_KEY)
    expect(root.dataset.theme).toBe('dark')
  })

  it('ignores unsupported values and blocked storage', () => {
    expect(themePreference(fakeStorage({ [THEME_STORAGE_KEY]: 'sepia' }))).toBeNull()
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(themePreference(blocked)).toBeNull()
  })

  it('removes its listeners on cleanup', () => {
    const media = fakeMedia(false)
    const events = fakeEvents()
    const stop = watchSystemTheme({
      root: fakeRoot(),
      media,
      storage: fakeStorage(),
      events,
    } as never)
    stop()
    expect(media.listeners.size).toBe(0)
    expect(events.listeners.size).toBe(0)
  })

  it('init script reads the same storage key', () => {
    expect(readFileSync('public/theme-init.js', 'utf8')).toContain(`'${THEME_STORAGE_KEY}'`)
  })
})
