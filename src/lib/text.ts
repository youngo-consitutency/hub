// Shared input normalisation for endpoint bodies.

export const trimmed = (v: unknown, max: number) =>
  String(v ?? '')
    .trim()
    .slice(0, max)

// Strips markup and collapses whitespace for fields that must never carry
// HTML. The pattern requires a letter/! after `<` ("a < b" survives) and
// tolerates a missing `>`. Applied to a fixpoint — one pass can weld
// "<<x>script" into "<script". Fixpoint is O(len²) worst case, so raw input
// is bounded to a window larger than `max`; `max` applies to the result.
export const cleanText = (v: unknown, max: number) => {
  let s = String(v ?? '').slice(0, Math.max(max * 4, 8192))
  for (let prev = ''; prev !== s;) {
    prev = s
    s = s.replace(/<\/?[a-zA-Z!][^>]*>?/g, '')
  }
  return s.replace(/\s+/g, ' ').trim().slice(0, max)
}
