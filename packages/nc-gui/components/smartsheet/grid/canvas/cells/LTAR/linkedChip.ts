import { isSingleRecordLinkColumn } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { resolveLinkedRecordDisplay } from '~/utils/linkedRecordDisplay'

export interface LinkedChipDisplay {
  column: ColumnType
  value: unknown
  meta?: TableType
}

/**
 * Column, value and meta to draw a linked record's chip with. Follows a display value that is itself
 * a single-record link down to its leaf; requests any hop meta that is not loaded yet.
 */
export const resolveLinkedChipDisplay = (
  props: Pick<CellRendererOptions, 'column' | 'metas' | 'tableMetaLoader' | 'relatedTableMeta'>,
  record: Record<string, any> | null | undefined,
): LinkedChipDisplay | undefined => {
  const { column, metas, tableMetaLoader, relatedTableMeta } = props

  const res = resolveLinkedRecordDisplay(record, relatedTableMeta, {
    metas,
    overrideColumnId: (column?.colOptions as LinkToAnotherRecordType)?.fk_display_value_column_id,
  })

  if (res.missingMeta) {
    const { tableId, baseId } = res.missingMeta
    if (tableMetaLoader && !tableMetaLoader.isLoading(tableId, baseId)) tableMetaLoader.getTableMeta(tableId, baseId)
    return
  }

  if (!res.complete || !res.leafColumn || isSingleRecordLinkColumn(res.leafColumn)) return

  return { column: res.leafColumn, value: res.leafValue, meta: res.leafMeta }
}
