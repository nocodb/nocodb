export const parseNumericDefault = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

// A prefilled default the user cleared goes as null; left out, the database would put it back.
// Hidden fields are deleted from formState, so they keep the database default.
export const keepClearedDefaults = (
  data: Record<string, any>,
  formState: Record<string, any>,
  prefilledDefaults: Record<string, any>,
) => {
  for (const [title, prefilled] of Object.entries(prefilledDefaults)) {
    if (prefilled === null || prefilled === undefined) continue
    if (title in formState && (formState[title] === null || formState[title] === undefined)) data[title] = null
  }
  return data
}
