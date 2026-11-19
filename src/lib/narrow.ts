// Small helpers for narrowing caught errors without `any`.

/** The `message` of a caught value, or '' when it has none. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ''
}

/** The string `code` property of a caught value, if it carries one. */
export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  return typeof error.code === 'string' ? error.code : undefined
}

/** A relationship value is the id, or the whole document when populated. */
export const idOf = <T extends { id: number }>(v: T | number | null | undefined) =>
  v != null && typeof v === 'object' ? v.id : v
