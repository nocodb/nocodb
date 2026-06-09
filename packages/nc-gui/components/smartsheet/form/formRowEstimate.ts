import { FORM_ROW_FULL_WIDTH_UI_TYPES, UITypes } from 'nocodb-sdk'

// Rough height estimates (px) used as the collapsed placeholder's min-height for
// off-screen rows in the JS lazy-render path (`Form.vue`). They only apply until a
// row has been rendered once — after that its real measured height is cached and
// reused — so a slightly-off estimate just affects the initial scrollbar/scroll-anchor.
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
 * Estimate a single form field's rendered height in px (used for the off-screen row
 * placeholder min-height, as a fallback before the row's real height is measured).
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
