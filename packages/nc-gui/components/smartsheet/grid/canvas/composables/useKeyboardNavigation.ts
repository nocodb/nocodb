import { type ColumnType } from 'nocodb-sdk'

const MAX_SELECTION_LIMIT = 100
const MIN_COLUMN_INDEX = 1
export function useKeyboardNavigation({
  totalRows,
  activeCell,
  columns,
  triggerReRender,
  scrollToCell,
  selection,
  editEnabled,
  copyValue,
  clearCell,
  clearSelectedRangeOfCells,
  makeCellEditable,
  expandForm,
  cachedRows,
  isAddingEmptyRowAllowed,
  addEmptyRow,
  addNewColumn,
  onActiveCellChanged,
}: {
  totalRows: Ref<number>
  activeCell: { row: number; column: number }
  triggerReRender: () => void
  columns: ComputedRef<CanvasGridColumn[]>
  scrollToCell: (row?: number, column?: number) => void
  selection: CellRange
  editEnabled: Ref<{
    rowIndex: number
    column: ColumnType
    row: Row
    x: number
    y: number
    width: number
    height: number
  } | null>
  copyValue: (target?: Cell) => void
  clearCell: (ctx: { row: number; col: number } | null, skipUpdate?: boolean) => Promise<void>
  clearSelectedRangeOfCells: () => Promise<void>
  makeCellEditable: (rowIndex: number, clickedColumn: CanvasGridColumn) => void
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
  cachedRows: Ref<Map<number, Row>>
  isAddingEmptyRowAllowed: ComputedRef<boolean>
  addNewColumn: () => void
  addEmptyRow: (row?: number, skipUpdate?: boolean, before?: string) => void
  onActiveCellChanged: () => void
}) {
  const { isDataReadOnly, isUIAllowed } = useRoles()
  const { $e } = useNuxtApp()

  const handleKeyDown = async (e: KeyboardEvent) => {
    const activeDropdownEl = document.querySelector(
      '.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active',
    )
    if (activeDropdownEl) {
      e.preventDefault()
      return true
    }
    if (isExpandedCellInputExist()) return

    if (isDrawerOrModalExist() || isLinkDropdownExist()) return
    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
    const altOrOptionKey = e.altKey

    if (e.key === ' ') {
      const isRichModalOpen = isExpandedCellInputExist()

      if (!editEnabled.value && isUIAllowed('dataEdit') && activeCell.row !== -1 && !isRichModalOpen) {
        e.preventDefault()
        const row = cachedRows.value.get(activeCell.row)
        if (!row) return
        expandForm(row)
        return
      }
    }

    let moved = false

    if (cmdOrCtrl && !editEnabled.value) {
      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault()
          copyValue()
          return
      }
    }

    if (e.shiftKey && selection.isEmpty()) {
      selection.startRange({ row: activeCell.row, col: activeCell.column })
    }

    const moveToExtreme = cmdOrCtrl
    const currentRow = activeCell.row
    const currentCol = activeCell.column
    const lastRow = totalRows.value - 1
    const lastCol = columns.value.length - 1

    if (altOrOptionKey) {
      switch (e.keyCode) {
        case 82: {
          // ALT + R
          if (isAddingEmptyRowAllowed.value) {
            $e('c:shortcut', { key: 'ALT + R' })
            addEmptyRow()
            activeCell.row = totalRows.value
            activeCell.column = 1
            selection.clear()
            scrollToCell(activeCell.row, 1)
          }
          return
        }
        case 67: {
          // ALT + C
          addNewColumn()
          break
        }
      }
    }

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (isDataReadOnly.value) return
        if (!editEnabled.value) {
          e.preventDefault()
          if (selection.isSingleCell()) {
            await clearCell?.({
              row: activeCell.row,
              col: activeCell.column,
            })
          } else {
            await clearSelectedRangeOfCells()
            selection.clear()
          }
        }
        return

      case 'Enter':
        selection.clear()
        if (e.shiftKey) return
        if (!editEnabled.value) {
          e.preventDefault()
          makeCellEditable(currentRow, columns.value[currentCol]!)
        } else {
          editEnabled.value = null
          activeCell.row++
        }
        break

      case 'Escape':
        if (editEnabled.value) {
          editEnabled.value = null
        }
        return

      case 'ArrowUp':
        if (!editEnabled.value && currentRow > 0) {
          e.preventDefault()
          activeCell.row = moveToExtreme ? 0 : currentRow - 1
          onActiveCellChanged()
          moved = true
        }
        break

      case 'ArrowDown':
        if (!editEnabled.value && currentRow < lastRow) {
          e.preventDefault()
          activeCell.row = moveToExtreme ? lastRow : currentRow + 1
          onActiveCellChanged()
          moved = true
        }
        break

      case 'ArrowLeft':
        if (!editEnabled.value && currentCol > MIN_COLUMN_INDEX) {
          e.preventDefault()
          activeCell.column = moveToExtreme ? MIN_COLUMN_INDEX : currentCol - 1
          moved = true
        }
        break

      case 'ArrowRight':
        if (!editEnabled.value && currentCol < lastCol) {
          e.preventDefault()
          activeCell.column = moveToExtreme ? lastCol : currentCol + 1
          moved = true
        }
        break

      case 'Tab': {
        let isAdded = false
        if (!editEnabled.value) {
          e.preventDefault()
          if (!e.shiftKey && currentRow === lastRow && currentCol === lastCol) {
            if (isAddingEmptyRowAllowed.value) {
              addEmptyRow()
              isAdded = true
            }
          } else if (e.shiftKey && currentRow === 0 && currentCol === MIN_COLUMN_INDEX) {
            return
          }

          if (e.shiftKey) {
            if (currentCol > MIN_COLUMN_INDEX) {
              activeCell.column--
            } else if (currentRow > 0) {
              activeCell.row--
              activeCell.column = lastCol
            }
          } else {
            if (currentCol < lastCol) {
              activeCell.column++
            } else if (currentRow < (isAdded ? lastRow + 1 : lastRow)) {
              activeCell.row++
              activeCell.column = MIN_COLUMN_INDEX
            }
          }
          moved = true
        }
        break
      }
    }

    if (moved) {
      if (e.shiftKey && e.key !== 'Tab') {
        const newEnd = { row: activeCell.row, col: activeCell.column }
        const maxRow = Math.max(selection._start?.row ?? 0, newEnd.row)
        const minRow = Math.min(selection._start?.row ?? 0, newEnd.row)

        if (maxRow - minRow >= MAX_SELECTION_LIMIT) {
          const direction = newEnd.row > (selection._start?.row ?? 0) ? 1 : -1
          const limitedRow = (selection._start?.row ?? 0) + (MAX_SELECTION_LIMIT - 1) * direction
          activeCell.row = limitedRow
          newEnd.row = limitedRow
        }

        selection.endRange(newEnd)
      } else {
        selection.clear()
        selection.startRange({ row: activeCell.row, col: activeCell.column })
        selection.endRange({ row: activeCell.row, col: activeCell.column })
      }

      scrollToCell(activeCell.row, activeCell.column)
    }
    triggerReRender()
  }

  useEventListener('keydown', handleKeyDown)
}
