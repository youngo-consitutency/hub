import * as Sentry from '@sentry/nextjs'
import type { PayloadRequest } from 'payload'

// Uniform error surface matching the legacy API contract:
// { error: { code, message, fields? } } with the same HTTP statuses.
export class ApiError extends Error {
  code: string
  status: number
  fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const fail = {
  validation: (fields: Record<string, string>, message = 'Please check the form.') =>
    new ApiError(400, 'validation', message, fields),
  notFound: (message = 'Not found.') => new ApiError(404, 'not_found', message),
  unauthorized: (message = 'Sign in to continue.') => new ApiError(401, 'unauthorized', message),
  forbidden: (message = 'You do not have access to this.') =>
    new ApiError(403, 'forbidden', message),
  conflict: (code: string, message: string, fields?: Record<string, string>) =>
    new ApiError(409, code, message, fields),
  unavailable: (message = 'This is not available right now.') =>
    new ApiError(503, 'unavailable', message),
  notImplemented: (message = 'This part of the Hub is still being migrated.') =>
    new ApiError(501, 'not_implemented', message),
}

type Handler = (req: PayloadRequest) => Promise<Response> | Response

export function endpoint(handler: Handler): Handler {
  return async (req) => {
    try {
      return await handler(req)
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          {
            error: {
              code: err.code,
              message: err.message,
              ...(err.fields ? { fields: err.fields } : {}),
            },
          },
          { status: err.status },
        )
      }
      // Platform module + pg errors carry status/code on a plain Error.
      // Payload errors (NotFound, Forbidden, Unauthorized) carry only status —
      // give them the contract's code so the SPA sees a consistent shape.
      const anyErr = err as { status?: number; code?: string; message?: string }
      if (anyErr?.status) {
        const code =
          anyErr.code ||
          (
            {
              400: 'validation',
              401: 'unauthorized',
              403: 'forbidden',
              404: 'not_found',
              409: 'conflict',
            } as Record<number, string>
          )[anyErr.status] ||
          'error'
        return Response.json(
          { error: { code, message: anyErr.message } },
          { status: anyErr.status },
        )
      }
      if (['23503', '23514', '22P02'].includes(anyErr?.code || '')) {
        return Response.json(
          {
            error: {
              code: 'validation',
              message: 'Check the linked record and field values.',
            },
          },
          { status: 400 },
        )
      }
      req.payload.logger.error({ err, path: req.routeParams?.slug ?? req.url }, 'endpoint failed')
      // Unhandled exception → error tracking. ApiError/status-coded branches
      // above are expected responses and stay out of Sentry on purpose.
      Sentry.captureException(err, {
        extra: { path: req.routeParams?.slug ?? req.url },
      })
      return Response.json(
        {
          error: {
            code: 'server_error',
            message: 'Something went wrong. Please try again.',
          },
        },
        { status: 500 },
      )
    }
  }
}

export const json = (data: unknown, init?: ResponseInit) => Response.json(data, init)

// Shared-cache policy for anonymous-safe public reads — CDN/edge caches (and
// SWR's client cache) hold them briefly; member data never takes this path.
export const PUBLIC_CACHE = 'public, s-maxage=60, stale-while-revalidate=300'
const NO_STORE = 'no-store'

/** Cache policy for views that differ between anonymous and verified members. */
export const viewCache = (res: Response, includePrivate: boolean): Response => {
  res.headers.set('Cache-Control', includePrivate ? NO_STORE : PUBLIC_CACHE)
  return res
}
