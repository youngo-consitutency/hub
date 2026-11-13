// every real page has its own route, so anything landing here is unknown. the member layout
// gates children behind a client-side account fetch, so a page-level notFound() never
// reaches the status line; a handler can answer a real 404
const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · YOUNGO Hub</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-content:center;min-height:100vh;margin:0;text-align:center">
<h1>Page not found</h1><p>That link doesn’t lead anywhere yet.</p><p><a href="/">Back home</a></p></body></html>`

export function GET() {
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
