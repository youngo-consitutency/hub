import sanitizeHtml from 'sanitize-html'
import { compile } from 'html-to-text'

// Small HTML subset for member-written email: formatting and safe links only.
const ALLOWED = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote']
const BLOCKS = new Set(['p', 'ul', 'ol', 'h2', 'h3', 'blockquote'])

function safeHref(raw: unknown) {
  const text = String(raw || '').trim()
  if (/^mailto:[^\s"'<>]+$/i.test(text)) return text
  try {
    const url = new URL(text)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
  } catch {}
  return ''
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED,
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  // text inside these goes too, not just the tag
  nonTextTags: [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'svg',
    'math',
    'noscript',
    'textarea',
    'title',
  ],
  transformTags: {
    b: 'strong',
    i: 'em',
    div: 'p',
    a: (_, attribs) => {
      const href = safeHref(attribs.href)
      return { tagName: 'a', attribs: href ? { href } : ({} as sanitizeHtml.Attributes) }
    },
  },
  // an unsafe link loses its tag but keeps its text. renaming it to a dropped tag
  // instead leaves a stale close in sanitize-html, so the next link closes as </span>
  exclusiveFilter: (frame) => (frame.tag === 'a' && !frame.attribs.href ? 'excludeTag' : false),
}

// loose top-level text from the editor gets a paragraph, so email clients style it.
// a stray top-level <li> gets a <ul> instead, since <p><li> renders as junk.
// input is already clean markup, so a depth count over tags is enough
function wrapLooseText(html: string) {
  let out = ''
  let run = ''
  let depth = 0
  let list = false
  const flush = () => {
    out += run.replace(/<[^>]+>/g, '').trim() ? `<p>${run}</p>` : run
    run = ''
  }
  for (const part of html.split(/(<[^>]+>)/)) {
    const tag = /^<(\/)?(\w+)/.exec(part)
    const strayLi = !depth && tag?.[2] === 'li' && !tag[1]
    if (list && !depth && !strayLi && part.trim()) {
      flush()
      out += '</ul>'
      list = false
    }
    if (tag && (BLOCKS.has(tag[2]) || tag[2] === 'li')) {
      if (!depth && !tag[1]) flush()
      if (strayLi && !list) {
        out += '<ul>'
        list = true
      }
      depth += tag[1] ? -1 : 1
      out += part
    } else if (depth) out += part
    else run += part
  }
  flush()
  return list ? `${out}</ul>` : out
}

// email clients drop stylesheets, so the send path inlines per-tag styles
function styleOptions(styles: Record<string, string>): sanitizeHtml.IOptions {
  return {
    allowedTags: ALLOWED,
    allowedAttributes: { '*': ['style'], a: ['href', 'style'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    transformTags: Object.fromEntries(
      Object.entries(styles).map(([tag, style]) => [
        tag,
        sanitizeHtml.simpleTransform(tag, { style }),
      ]),
    ),
  }
}

export function sanitizeEmailHtml(value: unknown, styles?: Record<string, string>) {
  const html = wrapLooseText(sanitizeHtml(String(value || '').slice(0, 20000), OPTIONS))
    .replace(/(?:\s*<br \/>\s*){3,}/g, '<br /><br />')
    .trim()
  return styles ? sanitizeHtml(html, styleOptions(styles)) : html
}

const toText = compile({
  wordwrap: false,
  selectors: [
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'h2', options: { uppercase: false } },
    { selector: 'h3', options: { uppercase: false } },
  ],
})

export const emailPlainText = (html: unknown) => toText(sanitizeEmailHtml(html)).trim()

// real text only, so list bullets, quote marks and numbering can't pad a near-empty message
export const emailTextLength = (html: unknown) =>
  emailPlainText(html)
    .replace(/^[ \t]*(?:(?:[*>]|\d+\.)(?=\s|$)[ \t]*)+/gm, '')
    .replace(/\s+/g, ' ')
    .trim().length
