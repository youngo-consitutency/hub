import type { CollectionConfig } from 'payload'
import { serverWrites } from '../lib/collectionAccess'
import type { AnyValue } from '../lib/domain'

// quiz answer keys must not ride along on public reads; the grader opts in
// with context.answerKey (see getDocument)
function withoutAnswerKey(body: AnyValue): AnyValue {
  if (!Array.isArray(body?.quiz)) return body
  return {
    ...body,
    quiz: body.quiz.map(({ correct: _correct, ...question }: AnyValue) => question),
  }
}

// Structured content documents — onboarding courses, policy catalogues,
// contact lists — edited in the console and served read-only to the member UI.
// `body` is JSON so documents keep the shape their consumers expect.
export const ContentDocuments: CollectionConfig = {
  slug: 'content-documents',
  access: {
    read: () => true,
    ...serverWrites,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    {
      name: 'body',
      type: 'json',
      required: true,
      hooks: {
        afterRead: [({ value, context }) => (context.answerKey ? value : withoutAnswerKey(value))],
      },
    },
  ],
}
