import { type ColumnType, UITypes } from 'nocodb-sdk'
import { NO_EDITABLE_CELL } from '../utils/cell'
import { EDIT_INTERACTABLE } from '../utils/constants'

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
    if (isViewSearchActive() || isCreateViewActive()) return
    const activeDropdownEl = document.querySelector(
      '.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active',
    )
    if (activeDropdownEl) {
      e.preventDefault()
      return true
    }
    if (isExpandedCellInputExist()) return
    if (isNcDropdownOpen()) return
    if (isCmdJActive() || cmdKActive()) return
    if (isDrawerOrModalExist() || isLinkDropdownExist() || isGeneralOverlayActive()) {
      // If Extension Pane is Active, ignore
      if (!isExtensionPaneActive()) return
    }
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

    if (activeCell.value.row !== -1 && activeCell.value.column !== -1 && selection.value.isSingleCell() && !cmdOrCtrl) {
      const column = columns.value[activeCell.value.column]
      const row = cachedRows.value.get(activeCell.value.row)
      if (row && column?.columnObj && !editEnabled.value) {
        const value = row.row[column.columnObj.title]
        const pk = extractPkFromRow(row.row, meta.value?.columns ?? [])
        const res = await handleCellKeyDown({ e, column, row, pk, value })

        if (res) {
          return
        }
      }
    }

    let moved = false
    let movedSelection = false

    if (cmdOrCtrl && (!editEnabled.value || EDIT_INTERACTABLE.includes(editEnabled.value?.column?.uidt))) {
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
        if (e.shiftKey) return
        if (!editEnabled.value) {
          e.preventDefault()
          const column = columns.value[activeCell.value.column]
          if (column?.columnObj?.uidt) {
            if (!NO_EDITABLE_CELL.includes(column.columnObj.uidt)) {
              selection.value.clear()
              makeCellEditable(activeCell.value.row, columns.value[activeCell.value.column]!)
            }
          }
        } else {
          const NO_ENTER_KEY_NAVIGATE_COLUMNS = [UITypes.Attachment, UITypes.Barcode, UITypes.QrCode]
          const column = columns.value[activeCell.value.column]?.columnObj
          if (column && NO_ENTER_KEY_NAVIGATE_COLUMNS.includes(column.uidt)) {
            return
          }
          editEnabled.value = null
          activeCell.value.row++
        }
        break

      case 'Escape':
        if (editEnabled.value) {
          editEnabled.value = null
          selection.value.clear()
          selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
          selection.value.endRange({ row: activeCell.value.row, col: activeCell.value.column })
          requestAnimationFrame(triggerReRender)
        }
        return

      case 'ArrowUp': {
        const currentEndRow = selection.value._end?.row ?? activeCell.value.row
        if (currentEndRow > 0) {
          e.preventDefault()
          const newRow = moveToExtreme ? 0 : currentEndRow - 1
          if (e.shiftKey) {
            const newEnd = {
              row: Math.max((selection.value._start?.row ?? 0) - MAX_SELECTION_LIMIT - 1, newRow),
              col: selection.value._end?.col ?? activeCell.value.column,
            }
            selection.value.endRange(newEnd)
            scrollToCell(newEnd.row, newEnd.col)
            movedSelection = true
          } else {
            activeCell.value.row = newRow
            moved = true
            onActiveCellChanged()
          }
        }
        break
      }

      case 'ArrowDown': {
        const currentEndRow = selection.value._end?.row ?? activeCell.value.row
        if (currentEndRow < lastRow) {
          e.preventDefault()
          const newRow = moveToExtreme ? lastRow : currentEndRow + 1
          if (e.shiftKey) {
            const newEnd = {
              row: Math.min((selection.value._start?.row ?? 0) + MAX_SELECTION_LIMIT - 1, newRow),
              col: selection.value._end?.col ?? activeCell.value.column,
            }
            selection.value.endRange(newEnd)
            movedSelection = true
          } else {
            activeCell.value.row = newRow
            moved = true
            onActiveCellChanged()
          }
        }
        break
      }

      case 'ArrowLeft': {
        const currentEndCol = selection.value._end?.col ?? activeCell.value.column
        if (currentEndCol > MIN_COLUMN_INDEX) {
          e.preventDefault()
          const newCol = moveToExtreme ? MIN_COLUMN_INDEX : currentEndCol - 1
          if (e.shiftKey) {
            selection.value.endRange({
              row: selection.value._end?.row ?? activeCell.value.row,
              col: newCol,
            })
            movedSelection = true
          } else {
            activeCell.value.column = newCol
            moved = true
          }
        }
        break
      }

      case 'ArrowRight': {
        const currentEndCol = selection.value._end?.col ?? activeCell.value.column
        if (currentEndCol < lastCol) {
          e.preventDefault()
          const newCol = moveToExtreme ? lastCol : currentEndCol + 1
          if (e.shiftKey) {
            selection.value.endRange({
              row: selection.value._end?.row ?? activeCell.value.row,
              col: newCol,
            })
            movedSelection = true
          } else {
            activeCell.value.column = newCol
            moved = true
          }
        }
        break
      }

      case 'Tab': {
        let isAdded = false
        e.preventDefault()
        if (!e.shiftKey && activeCell.value.row === lastRow && activeCell.value.column === lastCol) {
          if (isAddingEmptyRowAllowed.value) {
            addEmptyRow()
            isAdded = true
          }
        } else if (e.shiftKey && activeCell.value.row === 0 && activeCell.value.column === MIN_COLUMN_INDEX) {
          return
        }

        if (e.shiftKey) {
          if (activeCell.value.column > MIN_COLUMN_INDEX) {
            activeCell.value.column--
          } else if (activeCell.value.row > 0) {
            activeCell.value.row--
            activeCell.value.column = lastCol
          }
        } else {
          if (activeCell.value.column < lastCol) {
            activeCell.value.column++
          } else if (activeCell.value.row < (isAdded ? lastRow + 1 : lastRow)) {
            activeCell.value.row++
            activeCell.value.column = MIN_COLUMN_INDEX
          }
        }
        moved = true
        break
      }
    }

    if (moved || movedSelection) {
      editEnabled.value = null
      if (!e.shiftKey || e.key === 'Tab') {
        selection.value.clear()
        selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
        selection.value.endRange({ row: activeCell.value.row, col: activeCell.value.column })
      }

      if (moved) {
        scrollToCell(activeCell.value.row, activeCell.value.column)
      } else if (movedSelection) {
        scrollToCell(selection.value._end!.row, selection.value._end!.col)
      }
    }
    triggerReRender()
  }

  useEventListener('keydown', handleKeyDown)
}
