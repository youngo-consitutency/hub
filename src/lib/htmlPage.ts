// Small server-rendered pages for links opened from email (unsubscribe, verification, sign-up).
// Mail scanners and link previews fetch every URL in a message, so a GET must never change
// anything: the link opens a page and the change happens on the POST from its button.

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export const resultPage = (title: string, message: string) =>
  `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1rem;color:#14251d"><h1>${title}</h1><p>${message}</p><p><a href="/">Return to YOUNGO Hub</a></p></body></html>`

export const confirmPage = (title: string, message: string, action: string, button: string) =>
  resultPage(
    title,
    `${message}</p><form method="post" action="${action}"><button type="submit" style="font:inherit;padding:.6rem 1.2rem">${button}</button></form><p style="display:none">`,
  )

export const htmlResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
