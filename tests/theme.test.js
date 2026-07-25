import test from 'node:test'
import assert from 'node:assert/strict'
import {
  THEME_STORAGE_KEY,
  clearThemeOverride,
  resolvedTheme,
  storedTheme,
  systemTheme,
} from '../src/lib/theme.js'

test('system colour scheme is the default', () => {
  assert.equal(systemTheme(true), 'dark')
  assert.equal(systemTheme(false), 'light')
  assert.equal(resolvedTheme({ override: null, matchesDark: true }), 'dark')
  assert.equal(resolvedTheme({ override: null, matchesDark: false }), 'light')
})

test('an explicit user override wins over the system scheme', () => {
  assert.equal(resolvedTheme({ override: 'light', matchesDark: true }), 'light')
  assert.equal(resolvedTheme({ override: 'dark', matchesDark: false }), 'dark')
})

test('stored theme accepts only supported overrides', () => {
  const storage = (value) => ({
    getItem: (key) => {
      assert.equal(key, THEME_STORAGE_KEY)
      return value
    },
  })

  assert.equal(storedTheme(storage('dark')), 'dark')
  assert.equal(storedTheme(storage('light')), 'light')
  assert.equal(storedTheme(storage('system')), null)
  assert.equal(storedTheme(storage(null)), null)
})

test('theme override can return to the system setting', () => {
  let removedKey
  const storage = {
    removeItem: (key) => {
      removedKey = key
    },
  }
  assert.equal(clearThemeOverride(storage), systemTheme())
  assert.equal(removedKey, THEME_STORAGE_KEY)
})
