// Small HTML subset for member-written email: formatting and safe links only.
const ALLOWED = new Set([
  'p',
  'br',
  'strong',
  'em',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'blockquote',
])

const SELF_ENDING = new Set(['li', 'p'])

const RENAME = { b: 'strong', i: 'em', div: 'p' }

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

// single pass, so `&amp;lt;` decodes to the text `&lt;`, never to `<`
function decodeEntities(value) {
  return String(value ?? '').replace(
    /&(?:#(\d{1,7})|#x([\da-f]{1,6})|([a-z]+));/gi,
    (match, dec, hex, name) => {
      if (name) return ENTITIES[name.toLowerCase()] ?? match
      const code = dec ? Number(dec) : parseInt(hex, 16)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    },
  )
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function safeHref(raw) {
  const text = String(raw || '').trim()
  if (/^mailto:[^\s"'<>]+$/i.test(text)) return text
  try {
    const url = new URL(text)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
  } catch {
    return ''
  }
  return ''
}

/** @returns {{ tag: string, closing: boolean, html: string } | null} */
function parseTag(full) {
  const match = /^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>$/i.exec(full)
  if (!match) return null
  const closing = Boolean(match[1])
  const original = match[2].toLowerCase()
  if (original === 'br') return closing ? null : { tag: 'br', closing: false, html: '<br />' }
  const tag = RENAME[original] || original
  if (!ALLOWED.has(tag)) return null
  if (closing || tag !== 'a') return { tag, closing, html: closing ? `</${tag}>` : `<${tag}>` }
  const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[3] || '')
  const url = safeHref(href?.[1] || href?.[2] || href?.[3] || '')
  return url ? { tag, closing, html: `<a href="${escapeHtml(url)}">` } : null
}

/**
 * Keep a small set of formatting tags. Drop scripts, styles, and unsafe
 * links. Tags are balanced against a stack, so a dropped opening tag never
 * leaves its closing tag behind and truncated input still closes cleanly.
 */
export function sanitizeEmailHtml(value) {
  // strip to a fixpoint: one pass can leave `<scr<script>ipt>` behind
  let source = String(value || '').slice(0, 20000)
  for (let prev = ''; prev !== source;) {
    prev = source
    source = source
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(
        /<\s*(script|style|iframe|object|embed|form|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
        '',
      )
      .replace(/<\s*(script|style|iframe|object|embed|form|svg|math)\b[^>]*\/?\s*>/gi, '')
  }
  const open = []
  let html = ''
  for (const part of source.split(/(<[^>]+>)/g)) {
    if (!part.startsWith('<')) {
      // loose text from the editor gets a paragraph, so email clients style it
      if (part.trim() && !open.length) {
        open.push('p')
        html += '<p>'
      }
      // the editor sends entity-encoded text; decode once, then escape once
      html += escapeHtml(decodeEntities(part))
      continue
    }
    const parsed = parseTag(part)
    if (!parsed) continue
    if (parsed.tag === 'br') html += parsed.html
    else if (!parsed.closing) {
      // an unclosed <li> or <p> ends where the next one starts, as in browsers
      if (SELF_ENDING.has(parsed.tag) && open[open.length - 1] === parsed.tag) {
        html += `</${open.pop()}>`
      }
      open.push(parsed.tag)
      html += parsed.html
    } else if (open.includes(parsed.tag)) {
      while (open.length) {
        const tag = open.pop()
        html += `</${tag}>`
        if (tag === parsed.tag) break
      }
    }
  }
  while (open.length) html += `</${open.pop()}>`
  return html.replace(/(?:\s*<br \/>\s*){3,}/g, '<br /><br />').trim()
}

export function emailPlainText(html) {
  let text = sanitizeEmailHtml(html)
    .replace(/<br \/>/g, '\n')
    .replace(/<\/(p|h2|h3|li|blockquote)>/g, '\n')
  for (let prev = ''; prev !== text;) {
    prev = text
    text = text.replace(/<[^>]*>/g, '')
  }
  // one pass, so an escaped `&amp;lt;` stays literal text instead of becoming `<`
  return text
    .replace(/&(amp|lt|gt|quot);/g, (_, name) => ENTITIES[name])
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
