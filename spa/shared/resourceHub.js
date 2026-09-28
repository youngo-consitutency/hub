// Resource taxonomy and issue kinds are staff-editable content — served
// from the `content-options` document and fetched via useContentOptions;
// this file keeps code-only helpers.
export function resourceLabel(items, value) {
  return items.find((item) => item.value === value)?.label || value
}
