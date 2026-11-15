import type { CollectionConfig } from 'payload'
import { grantsCapability, noAccess } from '../lib/collectionAccess'
import { audit } from '../lib/audit'
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
    // documents are provisioned by scripts; publishers edit them in the /cms console
    create: noAccess,
    delete: noAccess,
    update: ({ req }) => grantsCapability(req, 'content.publish'),
  },
  hooks: {
    // a console edit leaves a trail; scripts and endpoints write without a user and audit themselves
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'update' || !req.user) return doc
        await audit(req, req.user, {
          action: 'content_document.update',
          targetType: 'content-documents',
          targetId: doc.slug,
        })
        return doc
      },
    ],
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    {
      name: 'body',
      type: 'json',
      required: true,
      hooks: {
        // the console edits the redacted read, so put the stored answer keys back by question id
        // (a new question has no key until one is set through a script)
        beforeChange: [
          async ({ value, originalDoc, operation, req }) => {
            if (operation !== 'update' || !originalDoc?.id || !Array.isArray(value?.quiz))
              return value
            const stored = await req.payload.findByID({
              collection: 'content-documents',
              id: originalDoc.id,
              context: { answerKey: true },
              overrideAccess: true,
              // no `req`: the context is shared with the request, so passing it would leave
              // answerKey set and the save response would carry the keys back out
            })
            const keys = new Map<string, string>(
              ((stored.body as AnyValue)?.quiz ?? []).map((q: AnyValue) => [q.id, q.correct]),
            )
            return {
              ...value,
              quiz: value.quiz.map((q: AnyValue) => ({
                ...q,
                correct: q.correct ?? keys.get(q.id),
              })),
            }
          },
        ],
        afterRead: [({ value, context }) => (context.answerKey ? value : withoutAnswerKey(value))],
      },
    },
  ],
}
