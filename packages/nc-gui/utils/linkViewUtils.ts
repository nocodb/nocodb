import type { LinkToAnotherRecordType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'

/**
 * The view a Link field is limited to, but only when it is a grid: a card view's `show` is just
 * what's on the card, not the field list. Callers pick their own fallback for `undefined` — the
 * expanded form uses the column's default-view meta, the linked-records list the first grid view.
 */
export const getLinkTargetGridViewId = (
  views: ViewType[] | undefined,
  colOptions: LinkToAnotherRecordType | undefined,
): string | undefined => {
  if (!colOptions?.fk_target_view_id) return undefined

  const targetView = (views ?? []).find((v) => v.id === colOptions.fk_target_view_id)

  return targetView?.type === ViewTypes.GRID ? targetView.id : undefined
}
