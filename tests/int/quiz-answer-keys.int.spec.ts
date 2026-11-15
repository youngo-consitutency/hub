import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testPayload } from './provision'
import { api, session } from './helpers'

// the console edits a redacted read of the course, so saving must not wipe the answer keys,
// and the keys must stay off every public read (the save response goes to the publisher only)
const tag = `quiz-${Math.random().toString(36).slice(2, 8)}`
const quiz = [
  { id: 'q1', prompt: 'One?', choices: ['a', 'b'], correct: 'a' },
  { id: 'q2', prompt: 'Two?', choices: ['c', 'd'], correct: 'd' },
]

describe('quiz answer keys', () => {
  let payload: Payload
  let docId: number | string
  let publisher: Awaited<ReturnType<typeof session>>

  const storedKeys = async () => {
    const doc = await payload.findByID({
      collection: 'content-documents',
      id: docId,
      context: { answerKey: true },
      overrideAccess: true,
    })
    return ((doc.body as { quiz: { id: string; correct?: string }[] }).quiz ?? []).map(
      (q) => q.correct,
    )
  }

  beforeAll(async () => {
    payload = await testPayload()
    publisher = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'content.publisher', scopeType: 'team', scopeId: 'content_publisher' }],
    })
    const doc = await payload.create({
      collection: 'content-documents',
      data: { slug: tag, title: tag, body: { passScore: 1, quiz } },
      overrideAccess: true,
    })
    docId = doc.id
  })

  afterAll(async () => {
    await payload
      .delete({ collection: 'content-documents', id: docId, overrideAccess: true })
      .catch(() => {})
  })

  it('serves no answer keys on a public read', async () => {
    const res = await api(`/content-documents/${docId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.body.quiz).toHaveLength(2)
    expect(JSON.stringify(body)).not.toContain('"correct"')
  })

  it('keeps the stored keys when a publisher saves the redacted quiz', async () => {
    const redacted = quiz.map(({ correct: _correct, ...question }) => question)
    const res = await api(`/content-documents/${docId}`, {
      method: 'PATCH',
      cookie: publisher.cookie,
      body: JSON.stringify({ body: { passScore: 1, quiz: redacted } }),
    })
    expect(res.status).toBe(200)
    expect(await storedKeys()).toEqual(['a', 'd'])
  })

  it('does not leave the answer-key context set after a save', async () => {
    // a later public read in the same process must still be redacted
    const res = await api(`/content-documents/${docId}`)
    expect(JSON.stringify(await res.json())).not.toContain('"correct"')
  })
})
