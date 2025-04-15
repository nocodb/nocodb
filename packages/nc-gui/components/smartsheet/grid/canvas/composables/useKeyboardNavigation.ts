import { type ColumnType, UITypes } from 'nocodb-sdk'
import { NO_EDITABLE_CELL } from '../utils/cell'
import { EDIT_INTERACTABLE } from '../utils/constants'
import { findFirstExpandedGroupWithPath, findGroupByPath, getDefaultGroupData } from '../utils/groupby'

// column types which support delete even when it's in edit state
const EDIT_MODE_CLEARABLE_TYPES = [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User]

const MAX_SELECTION_LIMIT = 100
const MIN_COLUMN_INDEX = 1
export function useKeyboardNavigation({
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
  cachedGroups,
  isAddingEmptyRowAllowed,
  addEmptyRow,
  addNewColumn,
  onActiveCellChanged,
  handleCellKeyDown,
  isGroupBy,
  getDataCache,
}: {
  isGroupBy: ComputedRef<boolean>
  activeCell: Ref<{ row: number; column: number; path?: Array<number> }>
  triggerReRender: () => void
  columns: ComputedRef<CanvasGridColumn[]>
  scrollToCell: (row?: number, column?: number, path?: Array<number>) => void
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
  copyValue: (target?: Cell, path?: Array<number>) => void
  clearCell: (ctx: { row: number; col: number; path?: Array<number> } | null, skipUpdate?: boolean) => Promise<void>
  clearSelectedRangeOfCells: (path?: Array<number>) => Promise<void>
  makeCellEditable: (row: Row, clickedColumn: CanvasGridColumn) => void
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean, path?: Array<number>) => void
  cachedGroups: Ref<Map<number, CanvasGroup>>
  isAddingEmptyRowAllowed: ComputedRef<boolean>
  addNewColumn: () => void
  addEmptyRow: (
    addAfter?: number,
    skipUpdate?: boolean,
    before?: string,
    overwrite?: Record<string, any>,
    path?: Array<number>,
  ) => Row | undefined
  onActiveCellChanged: () => void
  handleCellKeyDown: (ctx: { e: KeyboardEvent; row: Row; column: CanvasGridColumn; value: any; pk: any }) => Promise<boolean>
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
}) {
  const { isDataReadOnly } = useRoles()
  const { $e } = useNuxtApp()
  const meta = inject(MetaInj, ref())

  const _handleKeyDown = async (e: KeyboardEvent) => {
    if (isViewSearchActive() || isCreateViewActive() || isActiveElementInsideExtension()) return
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

    let groupPath: Array<number> = []
    let group: CanvasGroup

    let defaultData = {}

    if (isGroupBy.value) {
      if (activeCell.value.path?.length) {
        groupPath = activeCell.value.path
      } else {
        const group = findFirstExpandedGroupWithPath(cachedGroups.value)
        if (group.path?.length) groupPath = group.path
        else return
      }
      group = findGroupByPath(cachedGroups.value, groupPath)
      defaultData = getDefaultGroupData(group)
    }

    const dataCache = getDataCache(groupPath)

    const { cachedRows, totalRows } = dataCache

    if (e.key === ' ' && !e.shiftKey) {
      const isRichModalOpen = isExpandedCellInputExist()

      if (!editEnabled.value && activeCell.value.row !== -1 && !isRichModalOpen) {
        e.preventDefault()
        const row = cachedRows.value.get(activeCell.value.row)

        if (!row) return
        expandForm(row, undefined, false, groupPath)
        return
      }
    }

    if (activeCell.value.row !== -1 && activeCell.value.column !== -1 && selection.value.isSingleCell() && !cmdOrCtrl) {
      const column = columns.value[activeCell.value.column]
      const row = cachedRows.value.get(activeCell.value.row)
      if (row && column?.columnObj && !editEnabled.value) {
        const value = row.row[column.columnObj.title]
        const pk = extractPkFromRow(row.row, meta.value?.columns ?? [])
        const res = await handleCellKeyDown({ e, column, row, pk, value, path: groupPath })

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
          copyValue({ row: activeCell.value.row, col: activeCell.value.column }, groupPath)
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
            addEmptyRow(undefined, undefined, undefined, defaultData, groupPath)
            activeCell.value.row = totalRows.value
            activeCell.value.column = 1
            activeCell.value.path = groupPath
            selection.value.clear()
            scrollToCell(activeCell.value.row, 1, groupPath)
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
        if (
          !editEnabled.value ||
          EDIT_MODE_CLEARABLE_TYPES.includes(columns.value[activeCell.value.column]?.columnObj?.uidt as UITypes)
        ) {
          e.preventDefault()
          if (selection.value.isSingleCell()) {
            await clearCell?.({
              row: activeCell.value.row,
              col: activeCell.value.column,
              path: groupPath,
            })
          } else {
            await clearSelectedRangeOfCells(groupPath)
            selection.value.clear()
          }
          requestAnimationFrame(triggerReRender)
        }
        return

      case 'Enter':
        if (e.shiftKey) return
        if (!editEnabled.value) {
          e.preventDefault()
          const column = columns.value[activeCell.value.column]
          if (column?.columnObj?.uidt) {
            if (!NO_EDITABLE_CELL.includes(column.columnObj.uidt as UITypes) && !column.columnObj.readonly) {
              const row = cachedRows.value.get(activeCell.value.row)
              makeCellEditable(row, columns.value[activeCell.value.column]!)
              selection.value.clear()
            }
          }
        } else {
          const NO_ENTER_KEY_NAVIGATE_COLUMNS = [UITypes.Attachment, UITypes.Barcode, UITypes.QrCode]
          const column = columns.value[activeCell.value.column]?.columnObj
          if (column && NO_ENTER_KEY_NAVIGATE_COLUMNS.includes(column.uidt as UITypes)) {
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
            scrollToCell(newEnd.row, newEnd.col, groupPath)
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
            addEmptyRow(undefined, false, undefined, defaultData, groupPath)
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
        scrollToCell(activeCell.value.row, activeCell.value.column, groupPath)
      } else if (movedSelection) {
        scrollToCell(selection.value._end!.row, selection.value._end!.col, groupPath)
      }
    }
    triggerReRender()
  }

  const handleKeyDown = useThrottleFn(_handleKeyDown, 50)

  useEventListener('keydown', handleKeyDown)
}
