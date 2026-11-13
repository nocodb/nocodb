import type { ColumnType } from 'nocodb-sdk'

/**
 * Accessible name for a cell editor's input: the form view's custom field label when one
 * is set (so screen readers announce what is on screen), otherwise the column title.
 */
export function useCellAriaLabel() {
  const column = inject(ColumnInj, ref())

  return computed(() => (unref(column) as (ColumnType & { label?: string }) | undefined)?.label || unref(column)?.title)
}
