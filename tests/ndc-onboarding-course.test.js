import test from 'node:test'
import assert from 'node:assert/strict'
import { NDC_ONBOARDING_COURSE } from '../src/content/ndcOnboardingCourse.js'
import { getWgSelfPaced } from '../src/content/jtOnboardingCourse.js'
import { getWgOnboarding } from '../src/content/wgOnboarding.js'

test('ndcs self-paced onboarding covers the 2025/2026 deck', () => {
  const course = getWgSelfPaced('ndcs')
  assert.equal(course, NDC_ONBOARDING_COURSE)
  assert.equal(getWgSelfPaced('energy'), null)

  const ids = course.slides.map((slide) => slide.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.length >= 10)
  assert.equal(ids.at(-1), 'hear-from-you')
  assert.equal(course.brand.forest, '#674ea7')

  const text = JSON.stringify(course)
  for (const phrase of [
    'Salsalina Larasati',
    'Zipporah Njenga',
    'Global Stocktake',
    'Policies & Submissions',
    'Capacity building',
    'enhanced transparency framework',
    'Article 14',
    'youth-inclusive NDC checklist',
    'forms.gle/4GV5J8Dxwz6CQ5hK7',
    'chat.whatsapp.com/BR3buBxgmFe6sZpBONAA2U',
    'linkedin.com/company/youngondcwg',
    'instagram.com/youngondcwg',
    'unfccc.int/topics/global-stocktake',
  ]) {
    assert.match(
      text,
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
  }

  assert.doesNotMatch(text, /@/)
  assert.doesNotMatch(text, /PLLLEEE|CLICK ME/i)
})

test('ndcs rules still require one subgroup and protect meeting links', () => {
  const { rules, presentation } = getWgOnboarding('ndcs')
  assert.ok(
    rules.some((rule) =>
      rule.startsWith('Join at least one of the four subgroups'),
    ),
  )
  assert.ok(rules.some((rule) => rule.includes('meeting links')))
  assert.ok(
    presentation.some((line) => line.includes('self-paced introduction')),
  )
})
