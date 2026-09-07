const API = '/api/consultation/contributions'
const NOTES_KEY = 'youngo-hub-consultation-2026-09-notes'
const KINDS = {
  question: 'Question',
  concern: 'Concern',
  comment: 'Comment',
  feature: 'New feature',
}
const SECTIONS = {
  general: 'Whole consultation',
  open: 'Open',
  aims: 'Aims',
  need: 'Need',
  security: 'Security',
  concerns: 'Concerns',
  uses: 'Features',
  serve: 'Who it serves',
  safeguards: 'Safeguards',
  agree: 'Agree',
  next: 'Next steps',
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
const countBadge = document.getElementById('count-badge')
const dialog = document.getElementById('floor-dialog')
const backBtn = document.getElementById('sheet-back')
const pathButtons = [...document.querySelectorAll('.path button')]
const filterButtons = [...document.querySelectorAll('.filter')]
const steps = [...document.querySelectorAll('.sheet-step')]
const sectionSelect = document.getElementById('section')
const sectionFilter = document.getElementById('section-filter')

stage.append(
  ...document.getElementById('slides').content.cloneNode(true).children,
)
const slides = [...stage.querySelectorAll('.slide')]
const featureBoard = document.getElementById('feature-board')
const featureCards = featureBoard
  ? [...featureBoard.querySelectorAll('.feature-card')]
  : []

function closeFeatureCards() {
  if (!featureBoard) return false
  const open = featureBoard.classList.contains('is-open')
  featureBoard.classList.remove('is-open')
  featureCards.forEach((card) => {
    card.classList.remove('is-open')
    card.setAttribute('aria-expanded', 'false')
  })
  return open
}

featureCards.forEach((card) => {
  card.addEventListener('click', () => {
    const already = card.classList.contains('is-open')
    closeFeatureCards()
    if (already) return
    featureBoard.classList.add('is-open')
    card.classList.add('is-open')
    card.setAttribute('aria-expanded', 'true')
  })
})

let index = 0
let kind = 'question'
let filter = ''
let sectionView = ''
let items = []
let step = 'choose'

function fillSectionSelects() {
  const options = Object.entries(SECTIONS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('')
  sectionSelect.innerHTML = options
  sectionFilter.innerHTML = `<option value="">All sections</option>${options}`
}

function currentSection() {
  const path = slides[index]?.dataset.path
  return SECTIONS[path] ? path : 'general'
}

function joinUrl() {
  const url = new URL(location.href)
  url.hash = ''
  url.searchParams.delete('view')
  return `${url.origin}${url.pathname}`
}

function setStep(name) {
  step = name
  steps.forEach((node) =>
    node.classList.toggle('is-on', node.dataset.step === name),
  )
  backBtn.hidden = name === 'choose'
  if (name === 'write') {
    document.getElementById('write-kicker').textContent = KINDS[kind]
    document.getElementById('write-title').textContent =
      `Write your ${KINDS[kind].toLowerCase()}`
    if (!sectionSelect.value) sectionSelect.value = currentSection()
    document.getElementById('body').focus()
  }
}

function openFloor(start = 'choose') {
  setStep(start)
  if (typeof dialog.showModal === 'function') dialog.showModal()
  else dialog.setAttribute('open', '')
}

function closeFloor() {
  if (dialog.open) dialog.close()
  statusEl.textContent = ''
}

function show(i) {
  closeFeatureCards()
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
  const visible = items.filter(
    (item) =>
      (!filter || item.kind === filter) &&
      (!sectionView || item.section === sectionView),
  )
  countLine.textContent = items.length
    ? `${items.length} contribution${items.length === 1 ? '' : 's'} on the floor.`
    : 'Live contributions will appear here.'
  countBadge.hidden = !items.length
  countBadge.textContent = String(items.length)
  if (!visible.length) {
    feedEl.innerHTML = `<p class="empty-floor">${items.length ? 'Nothing in this filter yet.' : 'Be the first to send something to the floor.'}</p>`
    return
  }
  feedEl.innerHTML = visible
    .map(
      (item) => `<article class="feed-item ${item.kind}">
        <div class="feed-meta"><span>${KINDS[item.kind] || item.kind} · ${SECTIONS[item.section] || SECTIONS.general}</span><span>${item.name || 'Unnamed'} · ${timeLabel(item.createdAt)}</span></div>
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
    const response = await fetch(API, {
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

document
  .getElementById('open-floor')
  .addEventListener('click', () => openFloor('choose'))
document
  .getElementById('open-hear')
  .addEventListener('click', () => openFloor('hear'))
document.getElementById('sheet-close').addEventListener('click', closeFloor)
document
  .getElementById('see-floor')
  .addEventListener('click', () => setStep('hear'))
document
  .getElementById('add-another')
  .addEventListener('click', () => setStep('choose'))
backBtn.addEventListener('click', () =>
  setStep(step === 'write' ? 'choose' : 'choose'),
)
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeFloor()
})

document.querySelectorAll('.choose-btn').forEach((button) => {
  button.addEventListener('click', () => {
    kind = button.dataset.kind
    sectionSelect.value = currentSection()
    setStep('write')
  })
})

sectionFilter.addEventListener('change', () => {
  sectionView = sectionFilter.value
  renderFeed()
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
        section: sectionSelect.value,
        body: document.getElementById('body').value,
        name: document.getElementById('name').value,
        website: form.website.value,
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Could not send.')
    document.getElementById('body').value = ''
    statusEl.textContent = ''
    await loadFloor()
    setStep('hear')
  } catch (err) {
    statusEl.textContent = err.message || 'Could not send. Try again.'
  } finally {
    send.disabled = false
  }
})

document.getElementById('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(joinUrl())
    countLine.textContent =
      'Link copied. Anyone can open the slides and add to the floor.'
  } catch {
    countLine.textContent = joinUrl()
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
    ...items.map(
      (item) => `- [${item.kind}] [${item.section || 'general'}] ${item.body}`,
    ),
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
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)
  const open = dialog.open
  if (event.key === 'Escape' && open) return
  if (event.key === 'Escape' && closeFeatureCards()) {
    event.preventDefault()
    return
  }
  if (event.key === '?') helpEl.classList.toggle('is-on')
  else if (!typing && (event.key === 'n' || event.key === 'N') && !open)
    notesEl.classList.toggle('is-on')
  else if (!typing && (event.key === 'c' || event.key === 'C') && !open)
    openFloor('choose')
  else if (!typing && (event.key === 'l' || event.key === 'L') && !open)
    openFloor('hear')
  else if (!typing && (event.key === 'f' || event.key === 'F') && !open) {
    if (!document.fullscreenElement)
      document.getElementById('deck').requestFullscreen()
    else document.exitFullscreen()
  } else if (
    !typing &&
    !open &&
    ['ArrowRight', 'PageDown'].includes(event.key)
  ) {
    event.preventDefault()
    show(index + 1)
  } else if (!typing && !open && ['ArrowLeft', 'PageUp'].includes(event.key)) {
    event.preventDefault()
    show(index - 1)
  } else if (!typing && !open && event.key === 'Home') show(0)
  else if (!typing && !open && event.key === 'End') show(slides.length - 1)
})

fillSectionSelects()
loadNotes()
const fromHash = Number((location.hash || '').replace('#', '')) - 1
show(Number.isFinite(fromHash) && fromHash >= 0 ? fromHash : 0)
loadFloor()
setInterval(loadFloor, 4000)
if (new URLSearchParams(location.search).get('view') === 'join')
  openFloor('choose')
