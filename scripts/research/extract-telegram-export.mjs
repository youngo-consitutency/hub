/**
 * One-shot parse of a Telegram Desktop HTML chat export for Hub-feedable
 * opportunities, meetings, and WG activities.
 *
 * Usage:
 *   node scripts/research/extract-telegram-export.mjs "C:\path\to\ChatExport_…"
 *
 * Writes: data/research/telegram-export-<folder>.json (gitignored research/)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.join(ROOT, 'data', 'research')

const exportDir = process.argv[2]
if (!exportDir) {
  console.error(
    'Usage: node scripts/research/extract-telegram-export.mjs <ChatExportDir>',
  )
  process.exit(1)
}

const MEETING_RE =
  /zoom\.us|zoom\.com|meet\.google\.com|teams\.(microsoft|live)\.com|webex\.com/i
const FORM_RE =
  /forms\.gle|docs\.google\.com\/forms|airtable\.com|typeform\.com|tally\.so|notion\.site/i
const OPP_KW =
  /call for|deadline|apply|application|fellowship|internship|opportunity|scholarship|funding|nomination|register|webinar|workshop|session|recruit|vacancy|open call|expression of interest|\beoi\b|submission/i
const WG_ACT_KW =
  /wg (call|meeting|forum)|working group (call|meeting)|contact point|\bCP\b|action point|submission|position|dialogue|SB\d+|COP\d+|mid.?term review|action plan|WP review/i
const ACE_KW = /\bACE\b|Action for Climate Empowerment/i

function decode(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href="([^"]+)"[^>]*>.*?<\/a>/gis, (_, u) => u)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function extractLinks(html) {
  const links = []
  const re = /href="(https?:\/\/[^"]+)"/gi
  let m
  while ((m = re.exec(html))) {
    const u = m[1].replace(/&amp;/g, '&')
    if (!links.includes(u)) links.push(u)
  }
  return links
}

function snippet(t, n = 220) {
  const s = t.replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n)}…` : s
}

function titleGuess(text) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/[*_~`]/g, '').trim())
    .filter(Boolean)
  const headline =
    lines.find((l) =>
      /call for|fellowship|webinar|workshop|deadline|ACE WG|session|apply|meeting|CP|open call/i.test(
        l,
      ),
    ) ||
    lines[0] ||
    'Untitled'
  return headline.replace(/\s+/g, ' ').slice(0, 140)
}

function deadlineGuess(text) {
  const m =
    text.match(/deadline[:\s]*([^\n.]{3,60})/i) ||
    text.match(/due[:\s]*([^\n.]{3,40})/i) ||
    text.match(/by\s+(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i) ||
    text.match(
      /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    )
  return m ? m[1].trim() : null
}

function dateGuess(text) {
  const m =
    text.match(/(?:date|when|on)[:\s]*([^\n]{3,60})/i) ||
    text.match(
      /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\n]{0,40})/i,
    ) ||
    text.match(
      /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}[^\n]{0,40})/i,
    )
  return m ? m[1].trim().slice(0, 80) : null
}

function classify(m) {
  const hay = `${m.text} ${m.links.join(' ')}`
  const hasMeeting =
    m.links.some((l) => MEETING_RE.test(l)) ||
    /join (us|the call|zoom|meet)/i.test(m.text)
  const hasForm = m.links.some((l) => FORM_RE.test(l))
  const isOpp =
    OPP_KW.test(hay) &&
    (hasForm ||
      /deadline|apply|call for|fellowship|internship|scholarship|funding/i.test(
        hay,
      ))
  const isWg =
    WG_ACT_KW.test(hay) ||
    (ACE_KW.test(hay) &&
      (hasMeeting || hasForm || /deadline|session|workshop|call/i.test(hay)))
  const types = []
  if (isOpp) types.push('opportunity')
  if (hasMeeting) types.push('meeting')
  if (isWg) types.push('wg_activity')
  if (!types.length && (hasForm || m.text.length > 280)) types.push('notable')
  return types
}

function dedupe(arr, key = 'title') {
  const seen = new Set()
  return arr.filter((x) => {
    const k = String(x[key] || '')
      .toLowerCase()
      .slice(0, 80)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function parseExport(dir) {
  const files = [
    'messages.html',
    'messages2.html',
    'messages3.html',
    'messages4.html',
  ]
    .map((f) => path.join(dir, f))
    .filter((f) => fs.existsSync(f))

  const titleHtml = fs.readFileSync(files[0], 'utf8')
  const chatTitle =
    decode(
      (titleHtml.match(/<div class="text bold">\s*([\s\S]*?)\s*<\/div>/) ||
        [])[1] || '',
    ) || 'Group'

  const messages = []
  let currentDate = null

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8')
    const parts = html.split(/<div class="message /)
    for (const part of parts.slice(1)) {
      if (part.startsWith('service')) {
        const d = part.match(/<div class="body details">\s*([^<]+)/)
        if (d) {
          const label = d[1].trim()
          if (
            /^\d{1,2}\s+\w+\s+\d{4}/.test(label) ||
            /^\w+\s+\d{1,2},\s+\d{4}/.test(label)
          ) {
            currentDate = label
          }
        }
        continue
      }
      if (!part.startsWith('default')) continue
      const id = (part.match(/id="(message\d+)"/) || [])[1] || null
      const title = (part.match(/title="([^"]+)"/) || [])[1] || ''
      const fromBlocks = [
        ...part.matchAll(/<div class="from_name">\s*([\s\S]*?)\s*<\/div>/g),
      ].map((x) => decode(x[1]))
      const from =
        fromBlocks.find((n) => n && n !== 'Imported Message') ||
        fromBlocks[0] ||
        'Unknown'
      const textMatch = part.match(/<div class="text">\s*([\s\S]*?)\s*<\/div>/)
      if (!textMatch) continue
      const rawText = textMatch[1]
      const text = decode(rawText)
      if (!text) continue
      messages.push({
        id,
        dateLabel: currentDate,
        timestamp: title,
        from,
        text,
        links: extractLinks(rawText),
        file: path.basename(file),
      })
    }
  }

  return { chatTitle, messages }
}

const { chatTitle, messages } = parseExport(exportDir)
const classified = messages
  .map((m) => ({ ...m, types: classify(m) }))
  .filter((m) => m.types.length)

const opportunities = classified.filter((m) => m.types.includes('opportunity'))
const meetings = classified.filter((m) => m.types.includes('meeting'))
const wgActs = classified.filter((m) => m.types.includes('wg_activity'))

const folderSlug = path
  .basename(exportDir)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const summary = {
  scrapedAt: new Date().toISOString(),
  source: path.resolve(exportDir),
  chatTitle,
  inferredWg: ACE_KW.test(
    messages
      .slice(0, 50)
      .map((m) => m.text)
      .join(' '),
  )
    ? 'ace'
    : null,
  stats: {
    totalMessages: messages.length,
    classified: classified.length,
    opportunitiesRaw: opportunities.length,
    meetingsRaw: meetings.length,
    wgActivitiesRaw: wgActs.length,
    dateSpan: {
      first: messages[0]?.dateLabel || null,
      last: messages[messages.length - 1]?.dateLabel || null,
    },
  },
  opportunities: dedupe(
    opportunities.map((m) => ({
      id: m.id,
      postedAt: m.timestamp || m.dateLabel,
      from: m.from,
      title: titleGuess(m.text),
      deadlineHint: deadlineGuess(m.text),
      dateHint: dateGuess(m.text),
      links: m.links
        .filter((l) => FORM_RE.test(l) || /^https?:/i.test(l))
        .slice(0, 8),
      snippet: snippet(m.text),
      hubTarget: 'ngo_opportunity | announcement | submission',
      suggestedKind: /webinar|workshop|session/i.test(m.text)
        ? 'workshop'
        : /fellowship|internship|funding|scholarship/i.test(m.text)
          ? 'opportunity'
          : /call for|apply|deadline/i.test(m.text)
            ? 'opportunity'
            : 'call',
    })),
  ),
  meetings: dedupe(
    meetings.map((m) => ({
      id: m.id,
      postedAt: m.timestamp || m.dateLabel,
      from: m.from,
      title: titleGuess(m.text),
      dateHint: dateGuess(m.text),
      meetingUrls: m.links.filter((l) => MEETING_RE.test(l)),
      otherLinks: m.links.filter((l) => !MEETING_RE.test(l)).slice(0, 5),
      snippet: snippet(m.text),
      hubTarget: 'fixtures.events (wg_call/webinar) | wg_activities kind=call',
      suggestedWg: 'ace',
    })),
  ),
  wgActivities: dedupe(
    wgActs.map((m) => ({
      id: m.id,
      postedAt: m.timestamp || m.dateLabel,
      from: m.from,
      title: titleGuess(m.text),
      deadlineHint: deadlineGuess(m.text),
      dateHint: dateGuess(m.text),
      links: m.links.slice(0, 6),
      snippet: snippet(m.text),
      types: m.types,
      hubTarget: 'wg_activities (ace) | fixtures events/submissions',
      suggestedWg: 'ace',
      suggestedKind: /submission|input|position/i.test(m.text)
        ? 'submission'
        : /campaign|fellowship|awareness/i.test(m.text)
          ? 'campaign'
          : /call|meeting|session|workshop|webinar/i.test(m.text)
            ? 'call'
            : 'action_point',
    })),
  ),
}

summary.stats.opportunitiesUnique = summary.opportunities.length
summary.stats.meetingsUnique = summary.meetings.length
summary.stats.wgActivitiesUnique = summary.wgActivities.length

// Still-open-looking items (deadline/date mentions July/Aug 2026 or "upcoming"/no past year)
const now = new Date('2026-07-27')
function looksCurrent(item) {
  const hay = `${item.deadlineHint || ''} ${item.dateHint || ''} ${item.postedAt || ''} ${item.snippet || ''}`
  if (/2025\b/.test(hay) && !/2026\b/.test(hay)) return false
  if (
    /\b(January|February|March|April|May|June)\s+2026\b/i.test(hay) &&
    !/\b(July|August|September|October|November|December)\s+2026\b/i.test(hay)
  ) {
    // early 2026 dates are likely past relative to Jul 27 2026 unless still open language
    if (!/still open|extended|ongoing|rolling/i.test(hay)) return false
  }
  if (/\b(July|August|September|October|November|December)\s+2026\b/i.test(hay))
    return true
  if (
    /deadline|apply|register|upcoming|this week|tomorrow|today/i.test(hay) &&
    /2026|UTC/i.test(hay)
  ) {
    return true
  }
  // posted in last ~60 days of export window
  const posted = item.postedAt || ''
  if (/\b(0[5-7])\.2026\b|\b(May|June|July)\s+2026\b/i.test(posted)) return true
  void now
  return false
}

summary.likelyCurrent = {
  opportunities: summary.opportunities.filter(looksCurrent),
  meetings: summary.meetings.filter(looksCurrent),
  wgActivities: summary.wgActivities.filter(looksCurrent),
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const outFile = path.join(OUT_DIR, `telegram-${folderSlug || 'export'}.json`)
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2))

console.log(JSON.stringify(summary.stats, null, 2))
console.log(`chatTitle: ${summary.chatTitle}`)
console.log(`inferredWg: ${summary.inferredWg}`)
console.log(`\n=== OPPORTUNITIES (${summary.opportunities.length}) ===`)
summary.opportunities.forEach((o, i) => {
  console.log(`\n${i + 1}. ${o.title}`)
  console.log(
    `   posted: ${o.postedAt} | deadline: ${o.deadlineHint || '—'} | date: ${o.dateHint || '—'}`,
  )
  console.log(`   kind→ ${o.suggestedKind} | from: ${o.from}`)
  console.log(`   links: ${(o.links || []).slice(0, 3).join(' | ') || '—'}`)
  console.log(`   ${o.snippet.slice(0, 180)}`)
})
console.log(`\n=== MEETINGS (${summary.meetings.length}) ===`)
summary.meetings.forEach((o, i) => {
  console.log(`\n${i + 1}. ${o.title}`)
  console.log(`   posted: ${o.postedAt} | date: ${o.dateHint || '—'}`)
  console.log(`   urls: ${(o.meetingUrls || []).join(' | ') || '—'}`)
})
console.log(`\n=== WG ACTIVITIES (${summary.wgActivities.length}) ===`)
summary.wgActivities.forEach((o, i) => {
  console.log(`\n${i + 1}. ${o.title}`)
  console.log(
    `   posted: ${o.postedAt} | deadline: ${o.deadlineHint || '—'} | kind→ ${o.suggestedKind}`,
  )
  console.log(`   ${o.snippet.slice(0, 180)}`)
})
console.log(`\n=== LIKELY CURRENT (relative to 2026-07-27) ===`)
console.log(
  JSON.stringify(
    {
      opportunities: summary.likelyCurrent.opportunities.map((x) => x.title),
      meetings: summary.likelyCurrent.meetings.map((x) => x.title),
      wgActivities: summary.likelyCurrent.wgActivities.map((x) => x.title),
    },
    null,
    2,
  ),
)
console.log(`\nWrote ${outFile}`)
