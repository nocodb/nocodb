import type { LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'
import { parseCellWidth } from './cell'
import type { CanvasGridColumn } from '~/lib/types'
import type { GetMetaParams } from '~/composables/useMetas'
import { getI18n } from '~/plugins/a.i18n'
import { getColumnTypeI18nName } from '~/utils/fieldTypeI18n'

/**
 * Header drag-drop landing spot: the dragged field is inserted *after*
 * `columns[getColumnDropTargetIndex(...)]`. Hovering a column means "insert
 * before it", except the display value — it is pinned first, so a drop on it
 * inserts right after it (`index - 1` there would be the row-number gutter,
 * which has no view column and silently drops the reorder).
 */
export function getColumnDropTargetIndex(columns: CanvasGridColumn[], hoveredIndex: number) {
  return columns[hoveredIndex]?.pv ? hoveredIndex : hoveredIndex - 1
}

// `order` is float4 on pg and float(8,2) on mysql: keep 2 decimals and check the stored value
const toStoredOrder = (n: number) => Math.round(n * 100) / 100

/**
 * `n` orders spread evenly and strictly between `prev` and `next` (null: whole numbers after
 * `prev`), all distinct and > 0 once stored; null when the gap is too small for them.
 */
function spreadOrders(prev: number, next: number | null, n: number): number[] | null {
  const orders: number[] = []
  let last = prev
  for (let i = 1; i <= n; i++) {
    const order = next === null ? Math.floor(prev) + i : toStoredOrder(prev + ((next - prev) * i) / (n + 1))
    if (!(order > last && Math.fround(order) > Math.fround(last))) return null
    orders.push(order)
    last = order
  }
  if (next !== null && !(last < next && Math.fround(last) < Math.fround(next))) return null
  return orders
}

/**
 * Orders to save when `movedId` is placed right before `beforeId` (null: at the end).
 * `viewCols` must hold every field of the view, hidden ones too, so the new order can't
 * equal a hidden field's. When the neighbours leave no room (equal orders, or a gap the
 * stored column can't represent), the moved field and the fewest following fields are
 * spread up to the next field with room; only changed orders are returned.
 */
export function getColumnReorderUpdates(
  viewCols: { id: string; order?: number | null }[],
  movedId: string,
  beforeId: string | null,
): Record<string, number> {
  const moved = viewCols.find((c) => c.id === movedId)
  if (!moved) return {}

  const others = viewCols.filter((c) => c.id !== movedId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  let index = beforeId ? others.findIndex((c) => c.id === beforeId) : -1
  if (index < 0) index = others.length

  // an order of 0 reads as unset, so the floor is 0
  const prevOrder = index > 0 ? others[index - 1]!.order ?? 0 : 0

  const run = [moved]
  for (let j = index; ; j++) {
    const orders = spreadOrders(prevOrder, j < others.length ? others[j]!.order ?? 0 : null, run.length)
    if (orders) {
      const updates: Record<string, number> = {}
      run.forEach((c, i) => {
        if (orders[i] !== c.order) updates[c.id] = orders[i]!
      })
      return updates
    }
    run.push(others[j]!)
  }
}

// Display value drop slot: gutter + left half of the display value; edgeX = gutter right border
export function getDisplayValueDropSlot(columns: CanvasGridColumn[], scrollLeft: number, x: number) {
  const pvIndex = columns.findIndex((c) => c.pv)
  const pvCol = columns[pvIndex]
  if (!pvCol) return null

  let left = 0
  for (let i = 0; i < pvIndex; i++) left += parseCellWidth(columns[i]?.width)
  if (!pvCol.fixed) left -= scrollLeft

  const gutterWidth = columns[0]?.uidt ? 0 : parseCellWidth(columns[0]?.width)
  const edgeX = Math.max(gutterWidth, left)
  const slotEnd = Math.max(gutterWidth, left + parseCellWidth(pvCol.width) / 2)

  return x >= 0 && x < slotEnd ? { pvCol, pvIndex, edgeX } : null
}

export function columnTypeName(column: CanvasGridColumn) {
  const { t, te } = getI18n().global
  return getColumnTypeI18nName(column?.columnObj, t, te)
}
export function getCustomColumnTooltip({
  column,
  metas,
  getMeta,
  baseId,
  isExternalLink = false,
}: {
  column: CanvasGridColumn
  metas: Record<string, TableType>
  baseId?: string
  isExternalLink: boolean
  getMeta?: (params: GetMetaParams) => Promise<TableType | null>
}): string {
  if (!isLinksOrLTAR(column.columnObj)) {
    return
  }
  const relOptions = column.columnObj.colOptions as LinkToAnotherRecordType

  if (!isExternalLink && !column.columnObj?.meta?.custom) {
    return
  }

  if (!relOptions) return

  // Get the related base ID for cross-base relationships
  const relatedBaseId = relOptions.fk_related_base_id || baseId

  // Helper to get meta by base and table ID
  const getMetaByKey = (tableBaseId: string | undefined, tableId: string) => {
    if (tableBaseId) {
      return metas[`${tableBaseId}:${tableId}`] || metas[tableId]
    }
    return metas[tableId]
  }

  const currentTable = getMetaByKey(baseId, column.columnObj.fk_model_id)
  const refTable = getMetaByKey(relatedBaseId, relOptions.fk_related_model_id)
  let mmTable: TableType
  if (relOptions.type === RelationTypes.MANY_TO_MANY) {
    // MM table is always in the same base as the related table
    const mmMeta = getMetaByKey(relatedBaseId, relOptions.fk_mm_model_id)
    if (mmMeta) {
      // skip if created by NocoDB
      mmTable = mmMeta?.title?.includes('nc_m2m_') ? null : mmMeta
    } else {
      // if metas not found in store, fetch it with correct base_id
      getMeta?.({ baseId: relatedBaseId, tableIdOrTitle: relOptions.fk_mm_model_id }).catch((_e) => {
        // do nothing
      })
    }
  }

  let currentTableColName = ''
  let refTableColName = ''
  let mmTableColName = ''
  let mmTableRefColName = ''

  if (
    relOptions.type === RelationTypes.MANY_TO_MANY ||
    relOptions.type === RelationTypes.BELONGS_TO ||
    (relOptions.type === RelationTypes.ONE_TO_ONE && column.columnObj?.meta?.bt)
  ) {
    currentTableColName = currentTable?.columns?.find((c) => c.id === relOptions.fk_child_column_id)?.title
    refTableColName = refTable?.columns?.find((c) => c.id === relOptions.fk_parent_column_id)?.title
    if (mmTable) {
      mmTableColName = mmTable?.columns?.find((c) => c.id === relOptions.fk_mm_child_column_id)?.title
      mmTableRefColName = mmTable?.columns?.find((c) => c.id === relOptions.fk_mm_parent_column_id)?.title
    }
  } else {
    currentTableColName = currentTable?.columns?.find((c) => c.id === relOptions.fk_parent_column_id)?.title
    refTableColName = refTable?.columns?.find((c) => c.id === relOptions.fk_child_column_id)?.title
  }

  // Generate a detailed tooltip for link-to-record fields.
  // The tooltip includes:
  // - Column type
  // - Current table and column
  // - Related table and column
  // - (Optional) many-to-many table with its linking columns
  //
  // Format example:
  //   Link column: Customers(id) → Products(product_id)
  //
  //   Through Orders_Products(customer_id, product_id)
  const tooltip = `${columnTypeName(column)}: ${[
    // Current table and column
    currentTable?.title || '',
    currentTableColName ? `(${currentTableColName})` : '',

    // Relation arrow
    ' → ',

    // Related table and column
    refTable?.title || '',
    refTableColName ? `(${refTableColName})` : '',

    // Many-to-many (optional)
    mmTable ? '\n\nThrough ' : '',
    mmTable ? mmTable.title : '',
    mmTableColName && mmTableRefColName ? `(${mmTableColName}, ${mmTableRefColName})` : '',
  ].join('')}`

  return tooltip
}
