import { readFile } from 'node:fs/promises'
import { validateContent } from '../../shared/contentValidation.js'

const file = new URL('../../data/fixtures.json', import.meta.url)

try {
  const content = JSON.parse(await readFile(file, 'utf8'))
  const errors = validateContent(content)
  if (errors.length > 0) {
    console.error('Content check failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    console.log('Content check passed: data/fixtures.json is valid.')
  }
} catch (error) {
  console.error(`Content check failed: ${error.message}`)
  process.exitCode = 1
}
