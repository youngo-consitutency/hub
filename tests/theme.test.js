import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_THEME,
  SYSTEM_THEME_QUERY,
  applyTheme,
  systemTheme,
  watchSystemTheme,
} from '../src/lib/theme.js'

test('the device colour preference is the only theme input', () => {
  assert.equal(DEFAULT_THEME, 'light')
  assert.equal(SYSTEM_THEME_QUERY, '(prefers-color-scheme: dark)')
  assert.equal(systemTheme(undefined), 'light')
  assert.equal(systemTheme({ matches: false }), 'light')
  assert.equal(systemTheme({ matches: true }), 'dark')
})

test('applyTheme updates the root colour mode', () => {
  const root = { dataset: {}, ownerDocument: null }
  assert.equal(applyTheme('dark', root), 'dark')
  assert.equal(root.dataset.theme, 'dark')
  assert.equal(applyTheme('unsupported', root), 'light')
  assert.equal(root.dataset.theme, 'light')
})

test('theme watcher follows device changes and cleans up its listener', () => {
  let changeListener
  let removedListener
  const media = {
    matches: false,
    addEventListener: (type, listener) => {
      assert.equal(type, 'change')
      changeListener = listener
    },
    removeEventListener: (type, listener) => {
      assert.equal(type, 'change')
      removedListener = listener
    },
  }
  const root = { dataset: {}, ownerDocument: null }
  const stop = watchSystemTheme({ root, media })
  assert.equal(root.dataset.theme, 'light')

  media.matches = true
  changeListener()
  assert.equal(root.dataset.theme, 'dark')

  stop()
  assert.equal(removedListener, changeListener)
})
