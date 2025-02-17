import { type ColumnType } from 'nocodb-sdk'
import { NO_EDITABLE_CELL } from '../utils/cell'

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
  handleCellKeyDown,
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
  handleCellKeyDown: (ctx: { e: KeyboardEvent; row: Row; column: CanvasGridColumn; value: any; pk: any }) => Promise<boolean>
}) {
  const { isDataReadOnly, isUIAllowed } = useRoles()
  const { $e } = useNuxtApp()
  const meta = inject(MetaInj, ref())

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

      if (!editEnabled.value && isUIAllowed('dataEdit') && activeCell.value.row !== -1 && !isRichModalOpen) {
        e.preventDefault()
        const row = cachedRows.value.get(activeCell.value.row)
        if (!row) return
        expandForm(row)
        return
      }
    }

    if (activeCell.value.row !== -1 && activeCell.value.column !== -1 && selection.value.isSingleCell()) {
      const column = columns.value[activeCell.value.column]
      const row = cachedRows.value.get(activeCell.value.row)
      if (row && column?.columnObj && !editEnabled.value) {
        const value = row[column.columnObj.title]
        const pk = extractPkFromRow(row.row, meta.value?.columns)
        const res = await handleCellKeyDown({ e, column, row, pk, value })

        if (res) {
          return
        }
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

    if (e.shiftKey && selection.value.isEmpty()) {
      selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
    }

    const moveToExtreme = cmdOrCtrl
    const currentRow = activeCell.value.row
    const currentCol = activeCell.value.column
    const lastRow = totalRows.value - 1
    const lastCol = columns.value.length - 1

    if (altOrOptionKey) {
      switch (e.keyCode) {
        case 82: {
          // ALT + R
          if (isAddingEmptyRowAllowed.value) {
            $e('c:shortcut', { key: 'ALT + R' })
            addEmptyRow()
            activeCell.value.row = totalRows.value
            activeCell.value.column = 1
            selection.value.clear()
            scrollToCell(activeCell.value.row, 1)
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
          if (selection.value.isSingleCell()) {
            await clearCell?.({
              row: activeCell.value.row,
              col: activeCell.value.column,
            })
          } else {
            await clearSelectedRangeOfCells()
            selection.value.clear()
          }
        }
        return

      case 'Enter':
        selection.value.clear()
        if (e.shiftKey) return
        if (!editEnabled.value) {
          e.preventDefault()
          const column = columns.value[activeCell.value.column]
          if (!NO_EDITABLE_CELL.includes(column.columnObj.uidt)) {
            makeCellEditable(currentRow, columns.value[currentCol]!)
          }
        } else {
          editEnabled.value = null
          activeCell.value.row++
        }
        break

      case 'Escape':
        if (editEnabled.value) {
          editEnabled.value = null
        }
        return

      case 'ArrowUp':
        if (currentRow > 0) {
          e.preventDefault()
          activeCell.value.row = moveToExtreme ? 0 : currentRow - 1
          onActiveCellChanged()
          moved = true
        }
        break

      case 'ArrowDown':
        if (currentRow < lastRow) {
          e.preventDefault()
          activeCell.value.row = moveToExtreme ? lastRow : currentRow + 1
          onActiveCellChanged()
          moved = true
        }
        break

      case 'ArrowLeft':
        if (currentCol > MIN_COLUMN_INDEX) {
          e.preventDefault()
          activeCell.value.column = moveToExtreme ? MIN_COLUMN_INDEX : currentCol - 1
          moved = true
        }
        break

      case 'ArrowRight':
        if (currentCol < lastCol) {
          e.preventDefault()
          activeCell.value.column = moveToExtreme ? lastCol : currentCol + 1
          moved = true
        }
        break

      case 'Tab': {
        let isAdded = false
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
            activeCell.value.column--
          } else if (currentRow > 0) {
            activeCell.value.row--
            activeCell.value.column = lastCol
          }
        } else {
          if (currentCol < lastCol) {
            activeCell.value.column++
          } else if (currentRow < (isAdded ? lastRow + 1 : lastRow)) {
            activeCell.value.row++
            activeCell.value.column = MIN_COLUMN_INDEX
          }
        }
        moved = true

        break
      }
    }

    if (moved) {
      editEnabled.value = null
      if (e.shiftKey && e.key !== 'Tab') {
        const newEnd = { row: activeCell.value.row, col: activeCell.value.column }
        const maxRow = Math.max(selection.value._start?.row ?? 0, newEnd.row)
        const minRow = Math.min(selection.value._start?.row ?? 0, newEnd.row)

        if (maxRow - minRow >= MAX_SELECTION_LIMIT) {
          const direction = newEnd.row > (selection.value._start?.row ?? 0) ? 1 : -1
          const limitedRow = (selection.value._start?.row ?? 0) + (MAX_SELECTION_LIMIT - 1) * direction
          activeCell.value.row = limitedRow
          newEnd.row = limitedRow
        }

        selection.value.endRange(newEnd)
      } else {
        selection.value.clear()
        selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
        selection.value.endRange({ row: activeCell.value.row, col: activeCell.value.column })
      }

      scrollToCell(activeCell.value.row, activeCell.value.column)
    }
    triggerReRender()
  }

  useEventListener('keydown', handleKeyDown)
}
