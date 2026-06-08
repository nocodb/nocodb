import { FORM_ROW_FULL_WIDTH_UI_TYPES, UITypes } from 'nocodb-sdk'

// Rough first-paint height estimates (px). `contain-intrinsic-size: auto <est>`
// means the browser caches each row's REAL size after first render, so these
// only affect the initial scrollbar/scroll-anchor before a row is ever painted.
const COMPACT_PX = 96 // label + single input row
const FULL_WIDTH_PX = 160 // LongText / Attachment / JSON
const INLINE_LIST_BASE_PX = 84 // label + container chrome
const INLINE_LIST_PER_OPTION_PX = 30 // each radio/checkbox option row
const INLINE_LIST_OPTIONS_CAP_PX = 252 // cap on the options-area height (matches the option container's max-height)

interface FormFieldLike {
  uidt?: string
  meta?: Record<string, any> | null
  colOptions?: { options?: unknown[] } | null
}

/**
 * Estimate a single form field's rendered height in px (for contain-intrinsic-size).
 * NOTE: `col.meta` must be an already-parsed object — a raw JSON string (valid per
 * the SDK `MetaType` union) would make the `meta.isList` check silently fail and
 * return the compact estimate. Form columns are pre-parsed where this is called.
 */
export function estimateFieldHeightPx(col: FormFieldLike | null | undefined): number {
  const uidt = col?.uidt
  if (uidt && (FORM_ROW_FULL_WIDTH_UI_TYPES as readonly string[]).includes(uidt)) {
    return FULL_WIDTH_PX
  }
  const isInlineList = !!col?.meta?.isList && (uidt === UITypes.SingleSelect || uidt === UITypes.MultiSelect)
  if (isInlineList) {
    const optionCount = col?.colOptions?.options?.length ?? 0
    return INLINE_LIST_BASE_PX + Math.min(INLINE_LIST_OPTIONS_CAP_PX, optionCount * INLINE_LIST_PER_OPTION_PX)
  }
  return COMPACT_PX
}

export function estimateRowHeightPx(fields: FormFieldLike[] | null | undefined): number {
  if (!fields?.length) return COMPACT_PX
  return Math.max(COMPACT_PX, ...fields.map(estimateFieldHeightPx))
}
