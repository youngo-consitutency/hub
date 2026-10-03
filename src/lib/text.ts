// Shared input normalisation for endpoint bodies.

export const trimmed = (v: unknown, max: number) =>
  String(v ?? '')
    .trim()
    .slice(0, max)

// Strips markup and collapses whitespace — for free-text fields that must
// never carry HTML. The tag pattern requires a letter/! after `<` (so plain
// text like "a < b" survives) and tolerates a missing `>` (so unterminated
// tags cannot slip through). The second pass removes any `<` still followed
// by a tag-starter — deletions can weld a surviving `<` to following text
// ("<<x>script" → "<script"), and this closes that reassembly hole.
export const cleanText = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/<\/?[a-zA-Z!][^>]*>?/g, '')
    .replace(/<(?=[a-zA-Z/!])/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
