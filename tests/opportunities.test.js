import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  OPPORTUNITY_FORMATS,
  OPPORTUNITY_KINDS,
  normalizeOpportunityInput,
} from '../server/lib/opportunities.js'

const valid = { kind: 'workshop', title: 'Intro to NDC tracking' }

describe('NGO posting input', () => {
  it('covers the posting types organisations were promised', () => {
    assert.deepEqual(
      OPPORTUNITY_KINDS.map((k) => k.value),
      ['event', 'workshop', 'hackathon', 'opportunity', 'call', 'training'],
    )
    assert.deepEqual(
      OPPORTUNITY_FORMATS.map((f) => f.value),
      ['online', 'in_person', 'hybrid'],
    )
  })

  it('defaults an unspecified format to online', () => {
    assert.equal(normalizeOpportunityInput(valid).format, 'online')
  })

  it('rejects a posting with no recognised type', () => {
    assert.throws(
      () => normalizeOpportunityInput({ ...valid, kind: 'webinar' }),
      { code: 'validation' },
    )
  })

  it('rejects an end time before the start time', () => {
    assert.throws(
      () =>
        normalizeOpportunityInput({
          ...valid,
          startsAt: '2026-09-10T10:00:00Z',
          endsAt: '2026-09-10T09:00:00Z',
        }),
      { code: 'validation' },
    )
  })

  it('accepts a normal date range and normalises it to ISO', () => {
    const item = normalizeOpportunityInput({
      ...valid,
      startsAt: '2026-09-10T10:00:00Z',
      endsAt: '2026-09-10T12:00:00Z',
    })
    assert.equal(item.startsAt, '2026-09-10T10:00:00.000Z')
    assert.equal(item.endsAt, '2026-09-10T12:00:00.000Z')
  })

  it('rejects an unparseable date rather than storing null silently', () => {
    assert.throws(
      () => normalizeOpportunityInput({ ...valid, deadlineAt: 'next friday' }),
      { code: 'validation' },
    )
  })

  it('accepts only http(s) links, so a posting cannot inject a script URL', () => {
    assert.equal(
      normalizeOpportunityInput({
        ...valid,
        linkUrl: 'https://example.org/signup',
      }).linkUrl,
      'https://example.org/signup',
    )
    for (const hostile of [
      'javascript:alert(1)',
      'data:text/html,<script>',
      'example.org/signup',
    ]) {
      assert.throws(
        () => normalizeOpportunityInput({ ...valid, linkUrl: hostile }),
        { code: 'validation' },
        `${hostile} must be rejected`,
      )
    }
  })

  it('treats a blank link as no link', () => {
    assert.equal(
      normalizeOpportunityInput({ ...valid, linkUrl: '' }).linkUrl,
      null,
    )
  })

  it('keeps an optional region under the storage budget', () => {
    assert.equal(
      normalizeOpportunityInput({ ...valid, region: '  Asia-Pacific  ' })
        .region,
      'Asia-Pacific',
    )
  })
})
