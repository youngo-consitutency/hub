// Deterministic extractive synthesis over GYS contributions (team-only).

function countBy(items, keyFn) {
  const counts = new Map()
  for (const item of items) {
    const key = keyFn(item) || 'Unspecified'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function firstSentence(text, max = 220) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const match = cleaned.match(/^(.+?[.!?])(\s|$)/)
  const sentence = match ? match[1] : cleaned
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence
}

export function synthesizeGysContributions(contributions = []) {
  const active = contributions.filter(
    (item) => item && item.status !== 'rejected',
  )
  const byTheme = countBy(active, (item) => item.theme)
  const byRegion = countBy(active, (item) => item.region)
  const byCountry = countBy(active, (item) => item.country)
  const bySubmitterType = countBy(active, (item) => item.submitterType)

  const bullets = active
    .filter((item) => String(item.body || '').trim())
    .slice(0, 12)
    .map((item) => ({
      text: firstSentence(item.body),
      theme: item.theme || null,
      citations: [{ contributionId: item.id, title: item.title }],
    }))
    .filter((item) => item.text)

  const themeLead = byTheme[0]?.label
  const answer =
    active.length === 0
      ? 'No contributions are available to synthesise yet.'
      : themeLead && themeLead !== 'Unspecified'
        ? `${active.length} inputs are in the active cycle. Leading theme: ${themeLead}.`
        : `${active.length} inputs are in the active cycle and ready for thematic consolidation.`

  return {
    answer,
    counts: {
      total: active.length,
      byTheme,
      byRegion,
      byCountry,
      bySubmitterType,
    },
    bullets,
    caveat:
      'Extractive synthesis from imported and tracked contributions — not an official Global Youth Statement. Review citations before advancing any demand into drafting.',
  }
}
