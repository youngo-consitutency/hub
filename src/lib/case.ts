// Key-case normalisation. Rows reach the codebase in two key styles —
// snake_case from raw SQL and camelCase from Payload documents — and views
// should not hand-maintain a `row.foo_bar ?? row.fooBar` fallback for every
// field. Normalise once at the boundary, then read canonical camelCase.
//
// Shallow by design: database rows are flat, and nested structures (json
// columns, Payload revision internals) are application data, not key-shape
// noise. Keys that already start with '_' (e.g. `_order`, `_parent_id`)
// are internal Payload bookkeeping and are left untouched.

/** Shallowly convert a row's snake_case keys to camelCase, preferring non-null values on collision. */
export function toCamelCase<T extends Record<string, unknown>>(
  obj: Record<string, unknown> | null | undefined,
): T {
  const result: Record<string, unknown> = {}
  if (!obj) return result as T
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.startsWith('_')
      ? key
      : key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase())
    // Keys that normalise to the same name collide on mixed-shape rows; a
    // nullish value never replaces one already populated.
    if (value == null && result[camelKey] != null) continue
    result[camelKey] = value
  }
  return result as T
}

/** Apply {@link toCamelCase} to each row in a list. */
export const toCamelCaseRows = <T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
): T[] => rows.map((row) => toCamelCase<T>(row))
