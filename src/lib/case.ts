// Normalise snake_case (raw SQL) and camelCase (Payload) keys once at the
// boundary. Shallow; '_'-prefixed Payload internals are untouched.

export function toCamelCase<T extends Record<string, unknown>>(
  obj: Record<string, unknown> | null | undefined,
): T {
  const result: Record<string, unknown> = {}
  if (!obj) return result as T
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.startsWith('_')
      ? key
      : key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase())
    // Colliding keys: a nullish value never replaces a populated one.
    if (value == null && result[camelKey] != null) continue
    result[camelKey] = value
  }
  return result as T
}

export const toCamelCaseRows = <T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
): T[] => rows.map((row) => toCamelCase<T>(row))
