import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist', 'node_modules', '.local-demo'] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Capitalised bindings are JSX components. Without the React plugin
      // ESLint cannot see them being rendered, so exempt them as bindings and
      // as destructured parameters (`{ icon: Icon }`).
      'no-unused-vars': [
        'error',
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' },
      ],
    },
  },
  {
    // Service worker runs in its own global scope — `clients`, `skipWaiting`,
    // and friends are not browser-window globals.
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
]
