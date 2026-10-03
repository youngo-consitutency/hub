// Shared input normalisation for endpoint bodies.

export const trimmed = (v: unknown, max: number) =>
  String(v ?? '')
    .trim()
    .slice(0, max)

// Strips markup and collapses whitespace — for free-text fields that must
// never carry HTML. The tag pattern requires a letter/! after `<` (so plain
// text like "a < b" survives) and tolerates a missing `>` (so unterminated
// tags cannot slip through). Applied to a fixpoint: a single pass can weld
// a surviving '<' to following text ("<<x>script" → "<script"), so the
// strip repeats until the string stops changing.
export const cleanText = (v: unknown, max: number) => {
  let s = String(v ?? '')
  for (let prev = ''; prev !== s;) {
    prev = s
    s = s.replace(/<\/?[a-zA-Z!][^>]*>?/g, '')
  }
  return s.replace(/\s+/g, ' ').trim().slice(0, max)
}
