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
// strip repeats until the string stops changing. The fixpoint is O(len²)
// worst case on adversarial input, so the raw input is bounded first — but
// to a window larger than `max`, since markup can otherwise push legitimate
// text past the cut; the `max` limit applies to the cleaned result.
export const cleanText = (v: unknown, max: number) => {
  let s = String(v ?? '').slice(0, Math.max(max * 4, 8192))
  for (let prev = ''; prev !== s;) {
    prev = s
    s = s.replace(/<\/?[a-zA-Z!][^>]*>?/g, '')
  }
  return s.replace(/\s+/g, ' ').trim().slice(0, max)
}
