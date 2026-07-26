import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  clearThemeOverride,
  resolvedTheme,
  storedTheme,
} from '../src/lib/theme.js'

test('light is the default colour scheme', () => {
  assert.equal(DEFAULT_THEME, 'light')
  assert.equal(resolvedTheme({ override: null }), 'light')
  assert.equal(resolvedTheme({ override: undefined }), 'light')
  assert.equal(resolvedTheme({ override: 'system' }), 'light')
})

test('an explicit user override wins over the default', () => {
  assert.equal(resolvedTheme({ override: 'dark' }), 'dark')
  assert.equal(resolvedTheme({ override: 'light' }), 'light')
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

test('clearing the override returns to the light default', () => {
  let removedKey
  const storage = {
    removeItem: (key) => {
      removedKey = key
    },
  }
  assert.equal(clearThemeOverride(storage), DEFAULT_THEME)
  assert.equal(removedKey, THEME_STORAGE_KEY)
})
