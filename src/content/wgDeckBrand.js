/** Shared slide brand for working-group onboarding. Each group overrides the label and, when it has its own deck, the colours. */

export const WG_DECK_BRAND = {
  label: 'Working group',
  mint: '#e7f6e4',
  forest: '#14632d',
  deep: '#0e4f24',
  lime: '#3c9a32',
  ink: '#24382c',
  muted: '#4d6556',
  blob: '#1f8f3d',
  rule: '#b7dfb4',
  sectionA: '#8fd36a',
  sectionB: '#4caf3a',
  sectionC: '#2f9a34',
  sectionD: '#1f8a3b',
}

export function deckStyle(brand) {
  const colours = { ...WG_DECK_BRAND, ...brand }
  return {
    '--jt-mint': colours.mint,
    '--jt-forest': colours.forest,
    '--jt-deep': colours.deep,
    '--jt-lime': colours.lime,
    '--jt-ink': colours.ink,
    '--jt-muted': colours.muted,
    '--jt-blob': colours.blob,
    '--jt-rule': colours.rule,
    '--jt-section-a': colours.sectionA,
    '--jt-section-b': colours.sectionB,
    '--jt-section-c': colours.sectionC,
    '--jt-section-d': colours.sectionD,
  }
}
