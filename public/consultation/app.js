const API = '/api/consultation/contributions'
const NOTES_KEY = 'youngo-hub-consultation-2026-09-notes'
const KINDS = {
  question: 'Question',
  concern: 'Concern',
  comment: 'Comment',
  feature: 'New feature',
}

const stage = document.getElementById('stage')
const notesEl = document.getElementById('notes')
const helpEl = document.getElementById('help')
const counter = document.getElementById('counter')
const bar = document.getElementById('bar')
const feedEl = document.getElementById('feed')
const form = document.getElementById('floor-form')
const statusEl = document.getElementById('form-status')
const countLine = document.getElementById('count-line')
const pathButtons = [...document.querySelectorAll('.path button')]
const kindButtons = [...document.querySelectorAll('.kind')]
const filterButtons = [...document.querySelectorAll('.filter')]

stage.append(
  ...document.getElementById('slides').content.cloneNode(true).children,
)
const slides = [...stage.querySelectorAll('.slide')]

let index = 0
let kind = 'question'
let filter = ''
let items = []

function joinUrl() {
  const url = new URL(location.href)
  url.hash = ''
  url.searchParams.set('view', 'join')
  return url.toString()
}

function setJoinMode(on) {
  document.documentElement.classList.toggle('is-join', on)
  const url = new URL(location.href)
  if (on) url.searchParams.set('view', 'join')
  else url.searchParams.delete('view')
  history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash || `#${index + 1}`}`,
  )
}

function show(i) {
  index = Math.max(0, Math.min(slides.length - 1, i))
  slides.forEach((slide, n) => slide.classList.toggle('is-on', n === index))
  counter.textContent = `${index + 1} / ${slides.length}`
  bar.style.width = `${((index + 1) / slides.length) * 100}%`
  const path = slides[index].dataset.path
  pathButtons.forEach((button) => {
    button.setAttribute(
      'aria-current',
      button.dataset.station === path ? 'true' : 'false',
    )
  })
  notesEl.textContent = slides[index].dataset.notes || ''
  const url = new URL(location.href)
  history.replaceState(null, '', `${url.pathname}${url.search}#${index + 1}`)
}

function timeLabel(iso) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

function renderFeed() {
  const visible = items.filter((item) => !filter || item.kind === filter)
  countLine.textContent = items.length
    ? `${items.length} contribution${items.length === 1 ? '' : 's'} on the floor.`
    : 'Live contributions will appear below.'
  if (!visible.length) {
    feedEl.innerHTML = `<p class="empty-floor">${items.length ? 'Nothing in this filter yet.' : 'Be the first to send something to the floor.'}</p>`
    return
  }
  feedEl.innerHTML = visible
    .map(
      (item) => `<article class="feed-item ${item.kind}">
        <div class="feed-meta"><span>${KINDS[item.kind] || item.kind}</span><span>${item.name || 'Unnamed'} · ${timeLabel(item.createdAt)}</span></div>
        <p>${escapeHtml(item.body)}</p>
      </article>`,
    )
    .join('')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function loadFloor() {
  try {
    const query = filter ? `?kind=${encodeURIComponent(filter)}` : ''
    const response = await fetch(`${API}${query}`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error('load failed')
    const data = await response.json()
    items = data.items || []
    renderFeed()
  } catch {
    countLine.textContent =
      'Could not reach the live floor yet. You can still follow the slides.'
  }
}

function saveNotes() {
  const principles = [...document.querySelectorAll('#principles input')].map(
    (input) => ({
      id: input.dataset.p,
      text: input.parentElement.textContent.trim(),
      agreed: input.checked,
    }),
  )
  localStorage.setItem(
    NOTES_KEY,
    JSON.stringify({
      principles,
      decisions: document.getElementById('decisions').value,
      questions: document.getElementById('questions').value,
      actions: document.getElementById('actions').value,
      messages: document.getElementById('messages').value,
    }),
  )
}

function loadNotes() {
  const raw = localStorage.getItem(NOTES_KEY)
  if (!raw) return
  try {
    const record = JSON.parse(raw)
    document.getElementById('decisions').value = record.decisions || ''
    document.getElementById('questions').value = record.questions || ''
    document.getElementById('actions').value = record.actions || ''
    document.getElementById('messages').value = record.messages || ''
    ;(record.principles || []).forEach((item) => {
      const input = document.querySelector(
        `#principles input[data-p="${item.id}"]`,
      )
      if (input) input.checked = Boolean(item.agreed)
    })
  } catch {
    /* ignore */
  }
}

kindButtons.forEach((button) => {
  button.addEventListener('click', () => {
    kind = button.dataset.kind
    kindButtons.forEach((node) =>
      node.setAttribute('aria-pressed', node === button ? 'true' : 'false'),
    )
  })
})

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter
    filterButtons.forEach((node) =>
      node.setAttribute('aria-pressed', node === button ? 'true' : 'false'),
    )
    loadFloor()
  })
})

pathButtons.forEach((button) => {
  button.addEventListener('click', () => show(Number(button.dataset.go)))
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const send = document.getElementById('send')
  send.disabled = true
  statusEl.textContent = 'Sending…'
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind,
        body: document.getElementById('body').value,
        name: document.getElementById('name').value,
        website: form.website.value,
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Could not send.')
    document.getElementById('body').value = ''
    statusEl.textContent = 'On the floor.'
    await loadFloor()
  } catch (err) {
    statusEl.textContent = err.message || 'Could not send. Try again.'
  } finally {
    send.disabled = false
  }
})

document.getElementById('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(joinUrl())
    statusEl.textContent = 'Join link copied.'
  } catch {
    statusEl.textContent = joinUrl()
  }
})

document.getElementById('copy').addEventListener('click', async () => {
  saveNotes()
  const raw = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}')
  const agreed = (raw.principles || [])
    .filter((item) => item.agreed)
    .map((item) => `- ${item.text}`)
  const text = [
    'YOUNGO Hub consultation facilitator notes',
    '',
    'Agreed principles',
    agreed.length ? agreed.join('\n') : '- None ticked yet',
    '',
    'Decisions',
    raw.decisions || '- None recorded',
    '',
    'Outstanding questions',
    raw.questions || '- None recorded',
    '',
    'Next steps',
    raw.actions || '- None recorded',
    '',
    'Live floor',
    ...items.map((item) => `- [${item.kind}] ${item.body}`),
  ].join('\n')
  try {
    await navigator.clipboard.writeText(text)
    document.getElementById('copy-status').textContent = 'Copied.'
  } catch {
    document.getElementById('copy-status').textContent = 'Copy failed.'
  }
})

;['decisions', 'questions', 'actions', 'messages'].forEach((id) => {
  document.getElementById(id).addEventListener('input', saveNotes)
})
document.getElementById('principles').addEventListener('change', saveNotes)

document.addEventListener('keydown', (event) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(event.target.tagName)
  if (event.key === '?') helpEl.classList.toggle('is-on')
  else if (!typing && (event.key === 'n' || event.key === 'N'))
    notesEl.classList.toggle('is-on')
  else if (!typing && (event.key === 'j' || event.key === 'J')) {
    setJoinMode(!document.documentElement.classList.contains('is-join'))
  } else if (!typing && (event.key === 'f' || event.key === 'F')) {
    if (!document.fullscreenElement)
      document.getElementById('deck').requestFullscreen()
    else document.exitFullscreen()
  } else if (!typing && ['ArrowRight', 'PageDown'].includes(event.key)) {
    event.preventDefault()
    show(index + 1)
  } else if (!typing && ['ArrowLeft', 'PageUp'].includes(event.key)) {
    event.preventDefault()
    show(index - 1)
  } else if (!typing && event.key === 'Home') show(0)
  else if (!typing && event.key === 'End') show(slides.length - 1)
})

const params = new URLSearchParams(location.search)
setJoinMode(params.get('view') === 'join')
loadNotes()
const fromHash = Number((location.hash || '').replace('#', '')) - 1
show(Number.isFinite(fromHash) && fromHash >= 0 ? fromHash : 0)
loadFloor()
setInterval(loadFloor, 4000)
