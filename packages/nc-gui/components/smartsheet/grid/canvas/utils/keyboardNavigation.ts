import type { UITypes } from 'nocodb-sdk'
import type { CanvasGridColumn } from '../../../../../lib/types'
import { NO_EDITABLE_CELL } from './constants'

const MIN_COLUMN_INDEX = 1

export function isNavigableColumn(column: CanvasGridColumn | undefined) {
  return (
    !!column &&
    !column.readonly &&
    !column.isSyncedColumn &&
    column.isCellEditable &&
    !NO_EDITABLE_CELL.includes(column.columnObj?.uidt as UITypes) &&
    !column.columnObj?.readonly
  )
}

export function isLastNavigableColumnInRow(columns: Array<CanvasGridColumn | undefined>, column: number, lastCol: number) {
  for (let i = column + 1; i <= lastCol; i++) {
    if (isNavigableColumn(columns[i])) return false
  }
  return true
}

export function findNextNavigableCellPosition({
  row,
  column,
  columns,
  lastRow,
  lastCol,
  isShiftKey,
}: {
  row: number
  column: number
  columns: Array<CanvasGridColumn | undefined>
  lastRow: number
  lastCol: number
  isShiftKey: boolean
}) {
  let currentRow = row
  let currentColumn = column
  const totalPositions = (lastRow + 1) * (lastCol + 1)

  for (let attempt = 0; attempt < totalPositions; attempt++) {
    if (isShiftKey) {
      if (currentColumn > MIN_COLUMN_INDEX) {
        currentColumn--
      } else if (currentRow > 0) {
        currentRow--
        currentColumn = lastCol
      } else {
        break
      }
    } else {
      if (currentColumn < lastCol) {
        currentColumn++
      } else if (currentRow < lastRow) {
        currentRow++
        currentColumn = MIN_COLUMN_INDEX
      } else {
        break
      }
    }

    if (currentColumn >= MIN_COLUMN_INDEX && currentColumn <= lastCol && isNavigableColumn(columns[currentColumn])) {
      return { row: currentRow, column: currentColumn }
    }
  }

  return {
    row: Math.min(Math.max(row, 0), lastRow),
    column: Math.min(Math.max(column, MIN_COLUMN_INDEX), lastCol),
  }
}
