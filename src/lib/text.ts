// Shared input normalisation for endpoint bodies.

export const trimmed = (v: unknown, max: number) =>
  String(v ?? '').trim().slice(0, max)

// Strips markup and collapses whitespace — for free-text fields that must
// never carry HTML.
export const cleanText = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
