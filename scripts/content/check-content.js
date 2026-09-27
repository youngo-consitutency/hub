import { readFile } from 'node:fs/promises'
import { validateContent } from '../../spa/shared/contentValidation.js'
import { WORKING_GROUPS } from '../../spa/shared/workingGroups.js'

const file = new URL('../../data/fixtures.json', import.meta.url)

try {
  const content = JSON.parse(await readFile(file, 'utf8'))
  const errors = validateContent(content)

  const fixtureBySlug = new Map(
    (content.groups || []).map((group) => [group.slug, group.name]),
  )
  for (const group of WORKING_GROUPS) {
    const fixtureName = fixtureBySlug.get(group.slug)
    if (!fixtureName) {
      errors.push(
        `shared/workingGroups.js slug "${group.slug}" is missing from fixtures.json groups`,
      )
    } else if (fixtureName !== group.name) {
      errors.push(
        `working group "${group.slug}" name mismatch: shared="${group.name}" fixtures="${fixtureName}"`,
      )
    }
  }
  for (const slug of fixtureBySlug.keys()) {
    if (!WORKING_GROUPS.some((group) => group.slug === slug)) {
      errors.push(
        `fixtures.json group "${slug}" is missing from shared/workingGroups.js`,
      )
    }
  }

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
