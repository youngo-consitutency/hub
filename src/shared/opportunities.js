// Opportunity kinds/formats are schema-level enums: the Payload select fields
// need static options at boot, so the list lives in this pure module shared by
// src/collections/Opportunities.ts and mcp-content.
export const OPPORTUNITY_KINDS = Object.freeze([
  { value: 'event', label: 'Event' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'call', label: 'Open call' },
  { value: 'training', label: 'Training' },
])

export const OPPORTUNITY_FORMATS = Object.freeze([
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
])

// value -> label lookups for display
export const OPPORTUNITY_KIND_LABELS = Object.freeze(
  Object.fromEntries(OPPORTUNITY_KINDS.map((item) => [item.value, item.label])),
)
export const OPPORTUNITY_FORMAT_LABELS = Object.freeze(
  Object.fromEntries(OPPORTUNITY_FORMATS.map((item) => [item.value, item.label])),
)

export const OPPORTUNITY_KIND_VALUES = OPPORTUNITY_KINDS.map((item) => item.value)
export const OPPORTUNITY_FORMAT_VALUES = OPPORTUNITY_FORMATS.map((item) => item.value)
