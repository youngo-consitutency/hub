import test from 'node:test'
import assert from 'node:assert/strict'
import {
  JT_ONBOARDING_COURSE,
  getWgSelfPaced,
} from '../src/content/jtOnboardingCourse.js'
import { getWgOnboarding } from '../src/content/wgOnboarding.js'

test('just-transition self-paced onboarding covers the 2026 decks', () => {
  const course = getWgSelfPaced('just-transition')
  assert.equal(course, JT_ONBOARDING_COURSE)
  assert.equal(getWgSelfPaced('energy'), null)

  const ids = course.slides.map((slide) => slide.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.length >= 10)
  assert.equal(ids.at(-1), 'take-part')

  const text = JSON.stringify(course)
  for (const phrase of [
    'Amany Darkaoui',
    'Masagus Fathan',
    'Policy Team',
    'Capacity Building Team',
    'Fossil Fuel Phase-out Taskforce',
    'Katowice Committee of Experts',
    'UAE Just Transition Work Programme',
    'Decision 3/CMA.5',
    'linktr.ee/just.transition.youngo',
    'COP31',
  ]) {
    assert.match(
      text,
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
  }

  assert.doesNotMatch(text, /@/)
  assert.doesNotMatch(
    text,
    /idarkaoui|fmubina|Use this slide|We don’t have a website/i,
  )
})

test('just-transition rules add the deck norms once, beside the shared rules', () => {
  const { rules } = getWgOnboarding('just-transition')
  const conduct = rules.filter((rule) =>
    rule.startsWith('Follow the YOUNGO Code of Conduct'),
  )
  assert.equal(conduct.length, 1)
  assert.ok(rules.some((rule) => rule.startsWith('Join at least one sub-team')))
})
