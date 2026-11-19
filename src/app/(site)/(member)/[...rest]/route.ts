import type { NextRequest } from 'next/server'
import { LEGACY_HUB_SEGMENTS, hubUrl } from '../../../../lib/hubUrl'

// catch-all: old Hub URLs redirect into the app, the rest get a real 404
// (the member layout's client-side gate hides a page-level notFound())
const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · YOUNGO Hub</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-content:center;min-height:100vh;margin:0;text-align:center">
<h1>Page not found</h1><p>That link doesn’t lead anywhere yet.</p><p><a href="/">Back home</a></p></body></html>`

export function GET(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (LEGACY_HUB_SEGMENTS.has(pathname.split('/')[1]))
    // the hash carries the old path and query into the app
    return Response.redirect(new URL(hubUrl(pathname + search), request.url), 308)
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
