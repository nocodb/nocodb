import { type ColumnType } from 'nocodb-sdk'

const MAX_SELECTION_LIMIT = 100
export function useKeyboardNavigation({
  totalRows,
  activeCell,
  columns,
  triggerReRender,
  scrollToCell,
  selection,
}: {
  totalRows: Ref<number>
  activeCell: Ref<{ row: number; column: number }>
  triggerReRender: () => void
  columns: ComputedRef<CanvasGridColumn[]>
  scrollToCell: (row?: number, column?: number) => void
  selection: Ref<CellRange>
  editEnabled: Ref<{
    rowIndex: number
    column: ColumnType
    row: Row
    x: number
    y: number
    width: number
    height: number
  } | null>
}) {
  const handleKeyDown = (e: KeyboardEvent) => {
    let moved = false

    if (e.shiftKey && selection.value.isEmpty()) {
      selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
    }

    const moveToExtreme = isMac() ? e.metaKey : e.ctrlKey

    switch (e.key) {
      case 'ArrowUp':
        if (activeCell.value.row > 0) {
          e.preventDefault()
          activeCell.value.row = moveToExtreme ? 0 : activeCell.value.row - 1
          moved = true
        }
        break

      case 'ArrowDown':
        if (activeCell.value.row < totalRows.value - 1) {
          e.preventDefault()
          activeCell.value.row = moveToExtreme ? totalRows.value - 1 : activeCell.value.row + 1
          moved = true
        }
        break

      case 'ArrowLeft':
        if (activeCell.value.column > 1) {
          e.preventDefault()
          activeCell.value.column = moveToExtreme ? 1 : activeCell.value.column - 1
          moved = true
        }
        break

      case 'ArrowRight':
        if (activeCell.value.column < columns.value.length - 1) {
          e.preventDefault()
          activeCell.value.column = moveToExtreme ? columns.value.length - 1 : activeCell.value.column + 1
          moved = true
        }
        break

      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          // Move left
          if (activeCell.value.column > 1) {
            activeCell.value.column--
          } else if (activeCell.value.row > 0) {
            activeCell.value.row--
            activeCell.value.column = columns.value.length - 1
          }
        } else {
          // Move right
          if (activeCell.value.column < columns.value.length - 1) {
            activeCell.value.column++
          } else if (activeCell.value.row < totalRows.value - 1) {
            activeCell.value.row++
            activeCell.value.column = 1
          }
        }
        moved = true
        break
    }
    if (moved) {
      if (e.shiftKey) {
        const newEnd = { row: activeCell.value.row, col: activeCell.value.column }
        const maxRow = Math.max(selection.value._start?.row ?? 0, newEnd.row)
        const minRow = Math.min(selection.value._start?.row ?? 0, newEnd.row)

        if (maxRow - minRow >= MAX_SELECTION_LIMIT) {
          // Reset active cell position and selection end
          const direction = newEnd.row > (selection.value._start?.row ?? 0) ? 1 : -1
          const limitedRow = (selection.value._start?.row ?? 0) + (MAX_SELECTION_LIMIT - 1) * direction
          activeCell.value.row = limitedRow
          newEnd.row = limitedRow
        }

        selection.value.endRange(newEnd)
      } else {
        selection.value.clear()
        selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
      }
      scrollToCell(activeCell.value.row, activeCell.value.column)
      triggerReRender()
    }
  }

  useEventListener('keydown', handleKeyDown)
}
