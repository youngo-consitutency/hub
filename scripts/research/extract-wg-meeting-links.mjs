/**
 * One-shot WhatsApp scrape via Baileys: Zoom / Meet / Teams URLs in YOUNGO WG groups.
 *
 * Run (scan QR with the phone that is in the WG groups):
 *   npm run research:wg-meetings
 *
 * Writes: data/research/wg-meeting-links.json (gitignored)
 * Session: .local/baileys/ (gitignored)
 *
 * Does not index chat into Hub Intelligence — local extract only.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import qrcode from 'qrcode-terminal'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import P from 'pino'
import { WORKING_GROUPS } from '../../shared/workingGroups.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.join(ROOT, 'data', 'research')
const OUT_FILE = path.join(OUT_DIR, 'wg-meeting-links.json')
const SESSION_DIR = path.join(ROOT, '.local', 'baileys')

const HISTORY_WAIT_MS = Number(process.env.WG_WA_HISTORY_WAIT_MS || 45000)
const MESSAGE_LIMIT = Number(process.env.WG_WA_MSG_LIMIT || 80)

const MEETING_URL_RE =
  /https?:\/\/(?:[\w.-]+\.)?(?:zoom\.us|zoom\.com)\/[^\s<>"')]+|https?:\/\/meet\.google\.com\/[a-z0-9-]+|https?:\/\/teams\.(?:microsoft|live)\.com\/[^\s<>"')]+|https?:\/\/[\w.-]*webex\.com\/[^\s<>"')]+/gi

const CHANNEL_URL_RE =
  /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+|https?:\/\/t\.me\/[^\s<>"')]+|https?:\/\/linktr\.ee\/[^\s<>"')]+|https?:\/\/(?:docs\.google\.com|forms\.gle|airtable\.com)\/[^\s<>"')]+/gi

const WG_HINTS = WORKING_GROUPS.flatMap((g) => {
  const tokens = [
    g.slug.replaceAll('-', ' '),
    g.name.toLowerCase(),
    ...g.name
      .toLowerCase()
      .split(/[&/]+/)
      .map((s) => s.trim()),
  ]
  return tokens
    .filter(Boolean)
    .map((token) => ({ slug: g.slug, name: g.name, token }))
})

const GROUP_KEYWORDS = [
  'youngo',
  'wg',
  'working group',
  'constituency',
  'spokes',
  'coy',
  'lcoy',
  'gys',
  'ocean',
  'ace',
  'ndc',
  'adaptation',
  'mitigation',
  'finance',
  'gender',
  'nature',
  'energy',
  'health',
  'agriculture',
  'agri',
  'food',
  'human rights',
  'technology',
  'conflict of interest',
  'loss',
  'damage',
]

function cleanUrl(raw) {
  return String(raw || '')
    .replace(/[),.;!?]+$/g, '')
    .replace(/&amp;/g, '&')
    .trim()
}

function extractUrls(text, re) {
  if (!text) return []
  const found = String(text).match(re) || []
  return [...new Set(found.map(cleanUrl).filter(Boolean))]
}

function guessWgs(groupName) {
  const hay = String(groupName || '').toLowerCase()
  const hits = []
  for (const hint of WG_HINTS) {
    if (hay.includes(hint.token) && !hits.some((h) => h.slug === hint.slug)) {
      hits.push({ slug: hint.slug, name: hint.name })
    }
  }
  return hits
}

function isYoungoishGroup(name) {
  const hay = String(name || '').toLowerCase()
  return GROUP_KEYWORDS.some((k) => hay.includes(k))
}

function messageText(msg) {
  const m = msg.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsMessage?.contentText ||
    m.listMessage?.description ||
    m.templateMessage?.hydratedTemplate?.hydratedContentText ||
    ''
  )
}

function scrapeGroup(name, jid, messages) {
  const meetingUrls = new Map()
  const channelUrls = new Map()
  const samples = []
  const sorted = [...messages].sort(
    (a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0),
  )
  const recent = sorted.slice(-MESSAGE_LIMIT)

  for (const msg of recent) {
    const body = messageText(msg)
    const meetings = extractUrls(body, MEETING_URL_RE)
    const channels = extractUrls(body, CHANNEL_URL_RE)
    const ts = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : null

    for (const url of meetings) {
      if (!meetingUrls.has(url)) {
        meetingUrls.set(url, {
          url,
          lastSeenAt: ts,
          snippet: body.slice(0, 240),
        })
      }
    }
    for (const url of channels) {
      if (!channelUrls.has(url)) channelUrls.set(url, { url, lastSeenAt: ts })
    }
    if (meetings.length) {
      samples.push({ at: ts, urls: meetings, snippet: body.slice(0, 280) })
    }
  }

  return {
    chatId: jid,
    name,
    matchedWgs: guessWgs(name),
    messageCountScanned: recent.length,
    meetingUrls: [...meetingUrls.values()],
    channelUrls: [...channelUrls.values()],
    samples: samples.slice(-12),
  }
}

async function main() {
  await mkdir(SESSION_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  console.log(`
WhatsApp WG meeting-link extract (Baileys)
──────────────────────────────────────────
1. Scan the QR below (WhatsApp → Linked devices).
2. Keep this running while history syncs (~${Math.round(HISTORY_WAIT_MS / 1000)}s).
3. Report → ${path.relative(ROOT, OUT_FILE)}
`)

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()
  const messagesByJid = new Map()
  let groupMeta = {}

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: true,
    markOnlineOnConnect: false,
  })

  sock.ev.on('creds.update', saveCreds)

  const collect = (messages) => {
    for (const msg of messages || []) {
      const jid = msg.key?.remoteJid
      if (!jid || !jid.endsWith('@g.us')) continue
      if (!messagesByJid.has(jid)) messagesByJid.set(jid, [])
      messagesByJid.get(jid).push(msg)
    }
  }

  sock.ev.on('messages.upsert', ({ messages }) => collect(messages))
  sock.ev.on('messaging-history.set', ({ messages }) => {
    collect(messages)
    console.log(
      `  history chunk: +${(messages || []).length} msgs (group buckets: ${messagesByJid.size})`,
    )
  })

  await new Promise((resolve, reject) => {
    let settled = false
    let qrCount = 0
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      if (qr) {
        qrCount += 1
        console.log(
          `\nScan this QR with WhatsApp → Linked devices (refresh #${qrCount}; codes expire ~20s):\n`,
        )
        qrcode.generate(qr, { small: true })
      }
      if (connection === 'open' && !settled) {
        settled = true
        console.log('Connected. Fetching groups + waiting for history sync…')
        try {
          groupMeta = await sock.groupFetchAllParticipating()
        } catch (err) {
          console.warn(
            'groupFetchAllParticipating failed:',
            err?.message || err,
          )
          groupMeta = {}
        }
        console.log(
          `  ${Object.keys(groupMeta).length} groups visible. Collecting messages for ${Math.round(HISTORY_WAIT_MS / 1000)}s…`,
        )
        setTimeout(resolve, HISTORY_WAIT_MS)
      }
      if (connection === 'close' && !settled) {
        const code = lastDisconnect?.error?.output?.statusCode
        const loggedOut = code === DisconnectReason.loggedOut
        // 408 = QR / connect timed out — Baileys will emit a fresh QR; keep waiting.
        if (loggedOut) {
          reject(
            new Error(
              'WhatsApp logged out this session. Delete .local/baileys and re-scan QR.',
            ),
          )
          return
        }
        if (code === DisconnectReason.timedOut || code === 408) {
          console.warn('QR expired — wait for the next code and scan quickly.')
          return
        }
        console.warn(
          `Connection closed (code ${code}). Waiting for reconnect / new QR…`,
        )
      }
    })
  })

  const groups = Object.values(groupMeta)
  const candidates = groups.filter((g) => isYoungoishGroup(g.subject || ''))

  console.log(
    `Scanning ${candidates.length}/${groups.length} YOUNGO-ish groups…`,
  )

  const scanned = []
  for (const g of candidates) {
    const jid = g.id
    const name = g.subject || jid
    process.stdout.write(`  · ${name}\n`)
    const msgs = messagesByJid.get(jid) || []
    scanned.push(scrapeGroup(name, jid, msgs))
  }

  // Also scan unmatched YOUNGO-ish message jids not in meta (edge case)
  for (const [jid, msgs] of messagesByJid) {
    if (scanned.some((s) => s.chatId === jid)) continue
    const meta = groupMeta[jid]
    const name = meta?.subject || jid
    if (!isYoungoishGroup(name)) continue
    scanned.push(scrapeGroup(name, jid, msgs))
  }

  const withMeetings = scanned.filter((g) => g.meetingUrls.length > 0)
  const byWg = {}
  for (const g of WORKING_GROUPS) byWg[g.slug] = []
  byWg._unmatched = []

  for (const g of withMeetings) {
    const bucket =
      g.matchedWgs.length === 0 ? byWg._unmatched : byWg[g.matchedWgs[0].slug]
    for (const hit of g.meetingUrls) {
      bucket.push({
        url: hit.url,
        group: g.name,
        lastSeenAt: hit.lastSeenAt,
        snippet: hit.snippet,
      })
    }
  }

  const report = {
    scrapedAt: new Date().toISOString(),
    engine: 'baileys',
    historyWaitMs: HISTORY_WAIT_MS,
    messageLimit: MESSAGE_LIMIT,
    groupsTotal: groups.length,
    groupsScanned: scanned.length,
    groupsWithMeetingUrls: withMeetings.length,
    byWg,
    groups: scanned,
  }

  await writeFile(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`
Done.
  Groups with meeting URLs: ${withMeetings.length}/${scanned.length}
  Report: ${OUT_FILE}
`)

  for (const [slug, hits] of Object.entries(byWg)) {
    if (!hits.length) continue
    console.log(`  ${slug}: ${hits.length} url(s)`)
    for (const hit of hits.slice(0, 3)) console.log(`    - ${hit.url}`)
  }

  try {
    sock.end(undefined)
  } catch {
    /* ignore */
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
