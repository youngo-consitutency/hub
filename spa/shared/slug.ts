// Canonical title → slug used by both the Hub API and the MCP client so
// agent-submitted content lands on the same slug space as the web app.
// Returns '' when nothing usable remains — callers decide the fallback.
export function slugify(title: any) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
}
