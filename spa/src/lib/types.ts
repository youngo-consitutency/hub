/* eslint-disable @typescript-eslint/no-explicit-any --
 * Boundary aliases for values crossing the REST API and for view models
 * whose shapes are not yet modelled per endpoint. Naming them keeps the
 * untyped edges greppable instead of scattering anonymous `any`; fields
 * should tighten to real shapes endpoint by endpoint.
 */

/** An untyped JSON object row at an API boundary. */
export type Doc = Record<string, any>

/** An untyped scalar, object, or callable at a boundary. */
export type AnyValue = any

/** An untyped callable at a boundary. */
export type AnyFn = (...args: any[]) => any

/** A DOM event whose concrete element type is unknown at the boundary. */
export type SpaEvent = import('react').SyntheticEvent<Element> & {
  target: AnyValue
  currentTarget: AnyValue
}
