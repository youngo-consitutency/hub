/** Shared slide brand for working-group onboarding. Each group overrides the label and, when it has its own deck, the colours. */

export const WG_DECK_BRAND = {
  label: 'Working group',
  mint: '#e7f6e4',
  forest: '#14632d',
  deep: '#0e4f24',
  lime: '#3c9a32',
  ink: '#24382c',
  muted: '#4d6556',
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
  }
}
