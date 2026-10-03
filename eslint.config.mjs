import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    // spa/ is the member app — its own wouter router uses <a href> (not
    // next/link), and mount effects intentionally set state on load.
    // React-compiler-era strictness (nested components, render-time impurity)
    // flags working legacy patterns; kept visible as warnings, fixed
    // opportunistically.
    files: ['spa/**/*.{js,jsx,ts,tsx,mjs}'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
  {
    ignores: [
      '.next/',
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
    ],
  },
]

export default eslintConfig
