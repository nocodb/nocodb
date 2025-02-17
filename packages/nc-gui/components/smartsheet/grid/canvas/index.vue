<script setup lang="ts">
import { type ColumnType, type TableType, UITypes, type ViewType, isVirtualCol, readonlyMetaAllowedTypes } from 'nocodb-sdk'
import type { CellRange } from '../../../../composables/useMultiSelect/cellRange'
import { IsCanvasInjectionInj } from '../../../../context'
import { useCanvasTable } from './composables/useCanvasTable'
import Aggregation from './context/Aggregation.vue'
import { clearTextCache, defaultOffscreen2DContext, isBoxHovered } from './utils/canvas'
import Tooltip from './Tooltip.vue'
import { columnTypeName } from './utils/headerUtils'
import { EDIT_CELL_REDUCTION, MouseClickType, NO_EDITABLE_CELL, getMouseClickType } from './utils/cell'
import { COLUMN_HEADER_HEIGHT_IN_PX, MAX_SELECTED_ROWS } from './utils/constants'

const props = defineProps<{
  totalRows: number
  data: Map<number, Row>
  rowHeightEnum?: number
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
  callAddEmptyRow?: (addAfter?: number) => Row | undefined
  deleteRow?: (rowIndex: number, undo?: boolean) => Promise<void>
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
  ) => Promise<any>
  deleteSelectedRows: () => Promise<void>
  clearInvalidRows?: () => void
  deleteRangeOfRows: (cellRange: CellRange) => Promise<void>
  updateRecordOrder: (originalIndex: number, targetIndex: number | null) => Promise<void>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  bulkDeleteAll: () => Promise<void>
  bulkUpsertRows: (
    insertRows: Row[],
    updateRows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    newColumns?: Partial<ColumnType>[],
  ) => Promise<void>
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
  removeRowIfNew?: (row: Row) => void
  rowSortRequiredRows: Row[]
  applySorting?: (newRows?: Row | Row[]) => void
  clearCache: (visibleStartIndex: number, visibleEndIndex: number) => void
  syncCount: () => Promise<void>
  selectedRows: Array<Row>
  chunkStates: Array<'loading' | 'loaded' | undefined>
  isBulkOperationInProgress: boolean
  selectedAllRecords?: boolean
}>()

const emits = defineEmits(['bulkUpdateDlg', 'update:selectedAllRecords'])

provide(IsCanvasInjectionInj, true)

const {
  loadData,
  callAddEmptyRow,
  updateOrSaveRow,
  deleteRow,
  expandForm,
  clearCache,
  syncCount,
  bulkUpdateRows,
  bulkUpsertRows,
  deleteRangeOfRows,
  clearInvalidRows,
  updateRecordOrder,
  applySorting,
  bulkDeleteAll,
} = props

// VModels
const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

// Props to Refs
const totalRows = toRef(props, 'totalRows')
const chunkStates = toRef(props, 'chunkStates')
const cachedRows = toRef(props, 'data')
const rowHeightEnum = toRef(props, 'rowHeightEnum')
const selectedRows = toRef(props, 'selectedRows')
const rowSortRequiredRows = toRef(props, 'rowSortRequiredRows')

// Refs
const containerRef = ref()
const wrapperRef = ref()
const scrollTop = ref(0)
const scrollLeft = ref(0)
const overlayStyle = ref<Record<string, any> | null>(null)
const openAggregationField = ref<CanvasGridColumn | null>(null)
const openColumnDropdownField = ref<ColumnType | null>(null)
const isDropdownVisible = ref(false)
const contextMenuTarget = ref<{ row: number; col: number } | null>(null)
const _isContextMenuOpen = ref(false)
const isCreateOrEditColumnDropdownOpen = ref(false)
const columnEditOrAddProviderRef = ref()
const editColumn = ref<ColumnType | null>(null)
const isEditColumnDescription = ref(false)
const mousePosition = reactive({ x: 0, y: 0 })
const clientMousePosition = reactive({ clientX: 0, clientY: 0 })

const paddingLessUITypes = new Set([UITypes.LongText, UITypes.DateTime, UITypes.SingleSelect])

provide(ClientMousePositionInj, clientMousePosition)

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const isExpandTableModalOpen = ref(false)
// Injections
const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const reloadVisibleDataHook = inject(ReloadVisibleDataHookInj, undefined)
const isLocked = inject(IsLockedInj, ref(false))

// Composables
const { height, width } = useElementSize(wrapperRef)
const { aggregations, loadViewAggregate } = useViewAggregateOrThrow()
const { isDataReadOnly, isUIAllowed, isMetaReadOnly } = useRoles()
const { isMobileMode } = useGlobal()
const { $e } = useNuxtApp()
const tooltipStore = useTooltipStore()
const { showTooltip, hideTooltip } = tooltipStore
const { containerSize } = storeToRefs(tooltipStore)

const {
  rowSlice,
  colSlice,
  editEnabled,
  activeCell,
  totalWidth,
  columnWidths,
  rowHeight,
  updateVisibleRows,
  columns,
  findColumnIndex,
  canvasRef,
  triggerRefreshCanvas,
  resizeableColumn,
  resizeMouseMove,
  isDragging,
  startDrag,
  startResize,
  hoverRow,
  selection,
  partialRowHeight,
  makeCellEditable,

  // MouseSelectionHandler
  onMouseMoveSelectionHandler,
  onMouseDownSelectionHandler,
  onMouseUpSelectionHandler,

  // FillHandleHandler
  onMouseDownFillHandlerStart,
  onMouseMoveFillHandlerMove,
  onMouseUpFillHandlerEnd,
  isFillHandlerActive,

  // RowReorder
  onMouseDownRowReorderStart,
  isRowReOrderEnabled,

  // Order Column
  isOrderColumnExists,
  isInsertBelowDisabled,

  // Meta Information
  isPrimaryKeyAvailable,
  meta,
  view,
  isAddingColumnAllowed,
  // Selections
  isSelectedOnlyScript,
  isSelectedOnlyAI,
  isSelectionReadOnly,

  // Copy & Paste
  copyValue,
  clearCell,
  clearSelectedRangeOfCells,

  // Cell Click
  handleCellClick,

  // Cell Hover
  handleCellHover,

  actionManager,
  imageLoader,
} = useCanvasTable({
  rowHeightEnum,
  cachedRows,
  mousePosition,
  clearCache,
  chunkStates,
  totalRows,
  loadData,
  scrollLeft,
  width,
  height,
  scrollToCell,
  scrollTop,
  aggregations,
  vSelectedAllRecords,
  selectedRows,
  updateRecordOrder,
  expandRows,
  updateOrSaveRow,
  expandForm,
  bulkUpdateRows,
  bulkUpsertRows,
  addEmptyRow,
  onActiveCellChanged,
  addNewColumn: addEmptyColumn,
})

// Computed

const noPadding = computed(() => paddingLessUITypes.has(editEnabled.value?.column.uidt as UITypes))

const fixedLeftWidth = computed(() => {
  return columns.value.filter((col) => col.fixed).reduce((sum, col) => sum + parseInt(col.width, 10), 0)
})

const totalHeight = computed(() => {
  const rowsHeight = totalRows.value * rowHeight.value
  const headerHeight = 32
  return rowsHeight + headerHeight + 256
})

const isContextMenuOpen = computed({
  get: () => {
    if ((selectedRows.value.length && isDataReadOnly.value) || isDropdownVisible.value) return false
    return _isContextMenuOpen.value
  },
  set: (val) => {
    _isContextMenuOpen.value = val
  },
})

watch(vSelectedAllRecords, (val) => {
  cachedRows.value.forEach((row) => {
    row.rowMeta.selected = !!val
  })
})

const COLUMN_BUFFER_SIZE = 5

const calculateSlices = () => {
  if (!containerRef.value?.clientWidth || !containerRef.value?.clientHeight) {
    setTimeout(calculateSlices, 50)
    return
  }
  const startRowIndex = Math.max(0, Math.floor(scrollTop.value / rowHeight.value))
  const visibleRowCount = Math.ceil(containerRef.value.clientHeight / rowHeight.value)
  const endRowIndex = Math.min(startRowIndex + visibleRowCount, totalRows.value)
  const newEndRow = Math.min(totalRows.value, endRowIndex)

  const startColIndex = Math.max(0, findColumnIndex(scrollLeft.value))
  const endColIndex = Math.min(
    columnWidths.value.length,
    findColumnIndex(scrollLeft.value + containerRef.value.clientWidth + COLUMN_BUFFER_SIZE) + 1,
  )

  if (startRowIndex !== rowSlice.value.start || newEndRow !== rowSlice.value.end) {
    rowSlice.value = { start: startRowIndex, end: newEndRow }
  }

  if (startColIndex !== colSlice.value.start || endColIndex !== colSlice.value.end) {
    colSlice.value = { start: startColIndex, end: endColIndex }
  }

  updateVisibleRows()
}

function onActiveCellChanged() {
  clearInvalidRows?.()
  if (rowSortRequiredRows.value.length) {
    applySorting?.(rowSortRequiredRows.value)
  }
  triggerRefreshCanvas()
}

const onVisibilityChange = (value) => {
  if (value) {
    isDropdownVisible.value = true
  } else if (isCreateOrEditColumnDropdownOpen.value) {
    isDropdownVisible.value = columnEditOrAddProviderRef.value?.shouldKeepModalOpen()
    isCreateOrEditColumnDropdownOpen.value = columnEditOrAddProviderRef.value?.shouldKeepModalOpen()
    editColumn.value = null
  }
}

function closeAddColumnDropdownMenu(scrollToLastCol = false) {
  isCreateOrEditColumnDropdownOpen.value = false
  isDropdownVisible.value = false
  editColumn.value = null
  if (scrollToLastCol) {
    setTimeout(() => {
      containerRef.value?.scrollTo({ left: totalWidth.value, behavior: 'smooth' })
    }, 200)
  }
}

function findClickedColumn(x: number, scrollLeft = 0): { column: CanvasGridColumn; xOffset: number } {
  // First check fixed columns
  let xOffset = 0
  const fixedCols = columns.value.filter((col) => col.fixed)

  for (const column of fixedCols) {
    const width = columnWidths.value[columns.value.indexOf(column)] ?? 10
    if (x >= xOffset && x < xOffset + width) {
      if (!column.uidt) {
        xOffset += width
        continue
      }
      return { column, xOffset }
    }
    xOffset += width
  }

  // Then check scrollable columns
  const visibleStart = colSlice.value.start
  const visibleEnd = colSlice.value.end

  const startOffset = columnWidths.value.slice(0, visibleStart).reduce((sum, width) => sum + width, 0)

  xOffset = startOffset - scrollLeft

  for (let i = visibleStart; i < visibleEnd; i++) {
    const width = columnWidths.value[i] ?? 10
    if (x >= xOffset && x < xOffset + width) {
      return { column: columns.value[i], xOffset }
    }
    xOffset += width
  }

  return { column: null, xOffset }
}

const handleRowMetaClick = ({ e, row, x }: { e: MouseEvent; row: Row; x: number }) => {
  const isAtMaxSelection = selectedRows.value.length >= MAX_SELECTED_ROWS
  const isCheckboxDisabled = (!row.rowMeta.selected && isAtMaxSelection) || vSelectedAllRecords.value
  const isChecked = row.rowMeta?.selected || vSelectedAllRecords.value
  const isHover = hoverRow.value === row.rowMeta.rowIndex
  const regions = []
  let currentX = 4
  let isCheckboxRendered = false

  if (isChecked || (selectedRows.value.length && isHover)) {
    if (isChecked || isHover) {
      regions.push({
        x: currentX + 6,
        width: 24,
        action: isCheckboxDisabled ? 'none' : 'select',
      })
      isCheckboxRendered = true
      currentX += 30
    }
  } else {
    if (isHover && isRowReOrderEnabled.value) {
      regions.push({
        x: currentX,
        width: 24,
        action: 'reorder',
      })
      currentX += 24
    } else if (!isHover) {
      regions.push({
        x: currentX + 8,
        width: 24,
        action: 'none',
      })
      currentX += 24
    }
  }

  if (isHover && !isCheckboxRendered) {
    regions.push({
      x: currentX,
      width: 24,
      action: isCheckboxDisabled ? 'none' : 'select',
    })
    currentX += 24
  }

  // Comment/maximize icon region
  regions.push({
    x: currentX,
    width: row.rowMeta?.commentCount ? 24 : 14,
    action: 'comment',
  })

  const clickedRegion = regions.find((region) => x >= region.x && x < region.x + region.width)

  if (!clickedRegion) return

  switch (clickedRegion.action) {
    case 'select':
      if (!isCheckboxDisabled && (row.rowMeta?.selected || !isAtMaxSelection)) {
        row.rowMeta.selected = !row.rowMeta?.selected
        cachedRows.value.set(row.rowMeta.rowIndex!, row)
      }
      break

    case 'reorder':
      if (e.detail === 1 && isRowReOrderEnabled.value) {
        onMouseDownRowReorderStart(e)
      }
      break

    case 'comment':
      isExpandedFormCommentMode.value = !!row.rowMeta?.commentCount
      expandForm(row)
      break
  }

  triggerRefreshCanvas()
}

async function handleMouseDown(e: MouseEvent) {
  editEnabled.value = null
  openAggregationField.value = null
  openColumnDropdownField.value = null
  isDropdownVisible.value = false
  isContextMenuOpen.value = false
  contextMenuTarget.value = null

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const y = e.clientY - rect.top
  const x = e.clientX - rect.left

  const clickType = getMouseClickType(e)
  if (!clickType) return

  // Handle all Column Header Operations
  if (y <= COLUMN_HEADER_HEIGHT_IN_PX) {
    // If x less than 80px, use is hovering over the row meta column
    if (x < 80) {
      // If the click is not normal single click, return
      if (clickType !== MouseClickType.SINGLE_CLICK) return
      if (isBoxHovered({ x: 10, y: 8, height: 16, width: 16 }, mousePosition)) {
        vSelectedAllRecords.value = !vSelectedAllRecords.value
      }
      requestAnimationFrame(triggerRefreshCanvas)
      return
    } else {
      // If the user is trying to resize the column
      // If the user is trying to resize column, we will set the resizeableColumn to column object
      // The below operation will not interfere with other column operations
      startResize(e)
      await nextTick(() => {
        if (!resizeableColumn.value) {
          // If the user is not trying to resize column, we will check if the user is trying to drag the column
          // If the user is trying to drag the column, we will set the isDragging to true
          startDrag(e.clientX - rect.left)
          requestAnimationFrame(triggerRefreshCanvas)
        }
      })

      // If x more than 80px, check if the user is trying to add a new column
      const totalColumnsWidth = columns.value.reduce((acc, col) => acc + parseInt(col.width, 10), 0)
      const plusColumnX = totalColumnsWidth - scrollLeft.value
      const plusColumnWidth = 60
      // If the user is trying to add a new column
      if (x >= plusColumnX && x <= plusColumnX + plusColumnWidth) {
        // If the click is not normal single click, return
        if (clickType !== MouseClickType.SINGLE_CLICK) return
        isCreateOrEditColumnDropdownOpen.value = true
        overlayStyle.value = {
          top: `calc(100svh - ${height.value}px + 32px)`,
          left: `calc(100svw - ${width.value}px + ${plusColumnX - 200}px)`,
        }
        isDropdownVisible.value = true
        requestAnimationFrame(triggerRefreshCanvas)
        return
      }

      // If user is clicking on a existing column
      const { column: clickedColumn } = findClickedColumn(x, scrollLeft.value)
      if (clickedColumn) {
        // If the user clicked on a column, check if the user is trying to edit the column
        // On Double-click, should open the column edit dialog
        if (clickType === MouseClickType.DOUBLE_CLICK) {
          handleEditColumn(e, false, clickedColumn.columnObj)
          return
        } else if (clickType === MouseClickType.RIGHT_CLICK) {
          // IF Right-click on a column, open the column dropdown menu
          openColumnDropdownField.value = clickedColumn.columnObj
          isDropdownVisible.value = true
          overlayStyle.value = {
            top: `calc(100svh - ${height.value}px + ${32}px)`,
            minWidth: `${clickedColumn.width}`,
            width: `${clickedColumn.width}`,
            left: `calc(100svw - ${width.value}px + ${x}px)`,
          }
          requestAnimationFrame(triggerRefreshCanvas)
          return
        }
      }
      return
    }
  }

  // If the user is clicking on the Aggregation in bottom
  if (y > height.value - 36) {
    // If the click is not normal single click, return
    if (clickType !== MouseClickType.SINGLE_CLICK) return
    const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)
    if (clickedColumn) {
      openAggregationField.value = clickedColumn
      isDropdownVisible.value = true
      overlayStyle.value = {
        top: `${height.value - 162}px`,
        minWidth: `${clickedColumn.width}`,
        width: `${clickedColumn.width}`,
        left: `calc(100svw - ${width.value}px + ${xOffset}px)`,
      }
      requestAnimationFrame(triggerRefreshCanvas)
      return
    }
    return
  }

  // If the user is clicking on places other than header and aggregation
  // The rowIndex is calculated based on the y position of the mouse and rowSlice and partialRowHeight
  const rowIndex = Math.floor((y - 32 + partialRowHeight.value) / rowHeight.value) + rowSlice.value.start
  if (rowIndex === totalRows.value) {
    if (clickType !== MouseClickType.SINGLE_CLICK) return
    await addEmptyRow()
    selection.value.clear()
    activeCell.value.row = rowIndex
    activeCell.value.column = 1
    requestAnimationFrame(triggerRefreshCanvas)
    return
  } else if (rowIndex > totalRows.value) {
    selection.value.clear()
    activeCell.value = { row: -1, column: -1 }
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  if (x < 80) {
    const row = cachedRows.value.get(rowIndex)
    if (!row || clickType !== MouseClickType.SINGLE_CLICK) return
    handleRowMetaClick({ e, row, x })
    return
  }
  // Check if the user is clicking on a fillHandler
  // If user clicked on fillHandler, we set the isFillHandlerActive to true
  // So we can handle the fillHandler operations
  onMouseDownFillHandlerStart(e)
  if (isFillHandlerActive.value) return

  // Normal cell click operation
  // We set the activeCell to -1, -1 to clear the active cell
  if (rowIndex < rowSlice.value.start || rowIndex >= rowSlice.value.end) {
    activeCell.value.row = -1
    activeCell.value.column = -1
    requestAnimationFrame(triggerRefreshCanvas)
  }

  const { column: clickedColumn } = findClickedColumn(x, scrollLeft.value)

  if (!clickedColumn) {
    // If the user is not clicked in a column, clear the active cell and selection
    // Return
    activeCell.value.row = -1
    activeCell.value.column = -1
    selection.value.clear()
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  // If the new cell user clicked is not the active cell
  // call onActiveCellChanged to clear invalid rows and reorder records locally if required
  if (rowIndex !== activeCell.value?.row) {
    onActiveCellChanged()
  }

  // If the user is trying to open the context menu
  if (clickType === MouseClickType.RIGHT_CLICK) {
    activeCell.value.row = rowIndex
    activeCell.value.column = columns.value.findIndex((col) => col.id === clickedColumn.id)
    const columnIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)
    const isWithinSelection = selection.value.isCellInRange({ row: rowIndex, col: columnIndex })
    // If right-clicked cell is not within the selection, clear the selection and set the new cell as the selection
    if (!isWithinSelection) {
      selection.value.clear()
      selection.value.startRange({ row: rowIndex, col: columnIndex })
      selection.value.endRange({ row: rowIndex, col: columnIndex })
    }

    // Set the context Menu Targer and return
    contextMenuTarget.value = { row: rowIndex, col: columnIndex }
    await nextTick(() => {
      isContextMenuOpen.value = true
    })
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  // If the user is trying to click on a cell
  const row = cachedRows.value.get(rowIndex)
  if (!row) return
  const pk = extractPkFromRow(row?.row, meta.value?.columns as ColumnType[])
  const colIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)

  // handle the cellClick to corresponding cell.
  // If it performed an action, will return true

  const res = await handleCellClick({
    event: e,
    row: row!,
    column: clickedColumn,
    value: row?.row[clickedColumn.title],
    mousePosition: { x, y },
    pk,
    selected: activeCell.value.row === rowIndex && activeCell.value.column === colIndex,
    imageLoader,
  })
  // Set the active cell to the clicked cell
  activeCell.value.row = rowIndex
  activeCell.value.column = colIndex

  if (res) {
    // If the cellClick performed an action, return
    // Set the cell as selected
    selection.value.startRange({ row: rowIndex, col: colIndex })
    selection.value.endRange({ row: rowIndex, col: colIndex })
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }
  requestAnimationFrame(triggerRefreshCanvas)

  // Check if the cell support transfer to editable state
  // If not, just continue to onMouseDownSelectionHandler which is used for selection with mouse
  const columnUIType = clickedColumn.columnObj.uidt as UITypes
  // NO_EDITABLE_CELL is the list of cell types which are not editable
  if (NO_EDITABLE_CELL.includes(columnUIType)) {
    onMouseDownSelectionHandler(e)
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  // If the cell is editable, make the cell editable
  // Virtual Cells BARCODE, QRCode, Lookup, we need to render the actual cell if double clicked
  if (clickType === MouseClickType.DOUBLE_CLICK) {
    const supportedVirtualColumns = [UITypes.Barcode, UITypes.QrCode, UITypes.Lookup]
    if (!supportedVirtualColumns.includes(columnUIType) && clickedColumn?.virtual) return
    makeCellEditable(rowIndex, clickedColumn)
  } else {
    // If the cell is not double clicked, continue to onMouseDownSelectionHandler
    onMouseDownSelectionHandler(e)
  }
  requestAnimationFrame(triggerRefreshCanvas)
}

function scrollToCell(row?: number, column?: number) {
  if (!containerRef.value) return
  row = row ?? activeCell.value.row
  column = column ?? activeCell.value.column

  if (typeof row !== 'number' || !column) return

  const cellTop = row * rowHeight.value
  const cellBottom = cellTop + rowHeight.value + 96
  const scrollTop = containerRef.value.scrollTop
  const viewportHeight = containerRef.value.clientHeight

  if (cellTop < scrollTop) {
    containerRef.value.scrollTop = cellTop
  } else if (cellBottom > scrollTop + viewportHeight) {
    containerRef.value.scrollTop = cellBottom - viewportHeight
  }

  let cellLeft = 0
  let cellRight = 0

  const fixedWidth = columns.value.filter((col) => col.fixed).reduce((sum, col) => sum + parseInt(col.width, 10), 0) + 128

  for (let i = 0; i < column; i++) {
    if (!columns.value[i].fixed) {
      cellLeft += parseInt(columns.value[i].width, 10)
    }
  }
  cellRight = cellLeft + parseInt(columns.value[column].width, 10)

  cellLeft += fixedWidth
  cellRight += fixedWidth

  const scrollLeft = containerRef.value.scrollLeft
  const viewportWidth = containerRef.value.clientWidth

  if (cellLeft < scrollLeft + fixedWidth) {
    containerRef.value.scrollLeft = cellLeft - fixedWidth
  } else if (cellRight > scrollLeft + viewportWidth) {
    containerRef.value.scrollLeft = cellRight - viewportWidth
  }
}

const handleMouseUp = async (e: MouseEvent) => {
  e.preventDefault()
  onMouseUpFillHandlerEnd()
  onMouseUpSelectionHandler(e)

  editEnabled.value = null
  openAggregationField.value = null
  openColumnDropdownField.value = null
  isDropdownVisible.value = false
  editColumn.value = null
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const y = e.clientY - rect.top
  const x = e.clientX - rect.left

  if (y <= COLUMN_HEADER_HEIGHT_IN_PX && x < parseInt(columns.value[0]?.width ?? '', 10)) {
    if (isBoxHovered({ x: 10, y: 8, height: 16, width: 16 }, mousePosition)) {
      vSelectedAllRecords.value = !vSelectedAllRecords.value
      return
    }
  }

  if (y < 32 && x > 80) {
    const totalColumnsWidth = columns.value.reduce((acc, col) => acc + parseInt(col.width, 10), 0)
    const plusColumnX = totalColumnsWidth - scrollLeft.value
    const plusColumnWidth = 60

    if (x >= plusColumnX && x <= plusColumnX + plusColumnWidth) {
      isDropdownVisible.value = true
      isCreateOrEditColumnDropdownOpen.value = true
      overlayStyle.value = {
        top: `${rect.top}px`,
        left: `${plusColumnX + rect.left}px`,
        width: `${plusColumnWidth}px`,
        height: '32px',
        position: 'fixed',
      }
      return
    }
  }

  // Column Dropdown Menu
  if (y < 32 && (e.button === 2 || e.detail === 2) && x > 80) {
    const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)
    if (clickedColumn) {
      if (e.button === 2) {
        openColumnDropdownField.value = clickedColumn.columnObj
        isDropdownVisible.value = true
        overlayStyle.value = {
          top: `${rect.top}px`,
          left: `${rect.left + xOffset}px`,
          width: `${clickedColumn.width}`,
          height: `32px`,
          position: 'fixed',
        }
      } else if (e.detail === 2) {
        handleEditColumn(e, false, clickedColumn.columnObj)
      }
    }
    triggerRefreshCanvas()
    return
  } else if (y < 32 && x < 80) {
    return
  }

  // Column Dropdown Menu
  if (y <= 21 && y >= 9 && x > 80) {
    const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)

    if (!clickedColumn) return

    const columnWidth = parseInt(clickedColumn.width, 10)
    const iconOffsetX = xOffset + columnWidth - 24

    // check if clicked on the menu icon
    if (iconOffsetX > x || iconOffsetX + 14 < x) {
      return
    }

    if (clickedColumn) {
      openColumnDropdownField.value = clickedColumn.columnObj
      isDropdownVisible.value = true
      overlayStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.left + xOffset}px`,
        width: `${clickedColumn.width}`,
        height: `32px`,
        position: 'fixed',
      }
    }
    triggerRefreshCanvas()
    return
  }

  // Aggregation Dropdown Menu
  if (y > height.value - 36) {
    const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)
    if (clickedColumn) {
      openAggregationField.value = clickedColumn
      isDropdownVisible.value = true
      overlayStyle.value = {
        top: `${rect.top + height.value - 36}px`,
        left: `${rect.left + xOffset}px`,
        width: clickedColumn.width,
        height: `36px`,
        position: 'fixed',
      }
      triggerRefreshCanvas()
      return
    }
  }

  const rowIndex = Math.floor((y - 32 + partialRowHeight.value) / rowHeight.value) + rowSlice.value.start
  if (rowIndex === totalRows.value && e.button === 0) {
    await addEmptyRow()
    selection.value.clear()
    activeCell.value.row = rowIndex
    activeCell.value.column = 1
    return
  } else if (rowIndex > totalRows.value) {
    selection.value.clear()
    activeCell.value = { row: -1, column: -1 }
  }

  if (e.detail === 1 && x < 80) {
    const row = cachedRows.value.get(rowIndex)
    if (!row) return
    handleRowMetaClick({ e, row, x })
  }
}

const getHeaderTooltipRegions = (
  startColIndex: number,
  endColIndex: number,
  initialOffset: number,
  scrollLeftValue: number,
): {
  x: number
  width: number
  type: 'columnIcon' | 'title' | 'error' | 'info'
  text: string
}[] => {
  const regions: {
    x: number
    width: number
    type: 'columnIcon' | 'title' | 'error' | 'info'
    text: string
  }[] = []
  let xOffset = initialOffset + 1

  columns.value.slice(startColIndex, endColIndex).forEach((column) => {
    const width = parseInt(column.width, 10)
    const rightPadding = 8
    const iconSpace = rightPadding + 16

    if (column.uidt) {
      regions.push({
        x: xOffset + 8 - scrollLeftValue,
        width: 13,
        type: 'columnIcon',
        text: columnTypeName(column),
      })
    }

    const ctx = defaultOffscreen2DContext
    const availableTextWidth = width - (26 + iconSpace)
    const isTruncated = ctx.measureText(column.title!).width > availableTextWidth
    if (isTruncated) {
      regions.push({
        x: xOffset + 26 - scrollLeftValue,
        width: availableTextWidth,
        type: 'title',
        text: column.title!,
      })
    }

    let rightOffset = xOffset + width - rightPadding

    rightOffset -= 16

    // Error icon region
    if (column.isInvalidColumn?.isInvalid) {
      rightOffset -= 18
      regions.push({
        x: rightOffset - scrollLeftValue,
        width: 14,
        type: 'error',
        text: column.isInvalidColumn.tooltip || 'Invalid Column',
      })
    }

    // Info icon region
    if (column?.columnObj?.description?.length) {
      rightOffset -= 18
      regions.push({
        x: rightOffset - scrollLeftValue,
        width: 14,
        type: 'info',
        text: column.columnObj.description,
      })
    }

    xOffset += width
  })

  return regions
}

const handleMouseMove = (e: MouseEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  clientMousePosition.clientX = e.clientX
  clientMousePosition.clientY = e.clientY
  mousePosition.x = e.clientX - rect.left
  mousePosition.y = e.clientY - rect.top

  hideTooltip()

  if (mousePosition.y < 32) {
    let initialOffset = 0
    for (let i = 0; i < colSlice.value.start; i++) {
      initialOffset += parseInt(columns.value[i]!.width, 10)
    }

    const tooltipRegions = getHeaderTooltipRegions(colSlice.value.start, colSlice.value.end, initialOffset, scrollLeft.value)

    const activeRegion = tooltipRegions.find(
      (region) => mousePosition.x >= region.x && mousePosition.x <= region.x + region.width,
    )

    if (activeRegion) {
      showTooltip({
        position: { x: activeRegion.x, y: 16 },
        text: activeRegion.text,
      })
    }

    const fixedCols = columns.value.filter((col) => col.fixed)
    if (fixedCols.length) {
      const fixedRegions = getHeaderTooltipRegions(0, fixedCols.length, 0, 0)

      const activeFixedRegion = fixedRegions.find(
        (region) => mousePosition.x >= region.x && mousePosition.x <= region.x + region.width,
      )

      if (activeFixedRegion && activeRegion) {
        showTooltip({
          position: { x: activeRegion.x, y: 16 },
          text: activeFixedRegion.text,
        })
      }
    }
  }
  if (isFillHandlerActive.value) {
    onMouseMoveFillHandlerMove(e)
  } else if (isDragging.value || resizeableColumn.value) {
    if (e.clientX >= window.innerWidth - 200) {
      containerRef.value.scrollLeft += 10
    } else if (e.clientX <= 200) {
      containerRef.value.scrollLeft -= 10
    }
  } else {
    const y = e.clientY - rect.top
    if (y <= 32 && resizeableColumn.value) {
      resizeMouseMove(e)
    } else {
      hoverRow.value = Math.floor((y - 32 + partialRowHeight.value) / rowHeight.value) + rowSlice.value.start
      onMouseMoveSelectionHandler(e)
    }
    requestAnimationFrame(triggerRefreshCanvas)
  }
  if (mousePosition.y > 32) {
    const rowIndex = Math.floor((mousePosition.y - 32 + partialRowHeight.value) / rowHeight.value) + rowSlice.value.start
    const row = cachedRows.value.get(rowIndex)
    const { column } = findClickedColumn(mousePosition.x, scrollLeft.value)
    if (!row || !column) return
    const pk = extractPkFromRow(row?.row ?? {}, meta.value?.columns as ColumnType[])
    const colIndex = columns.value.findIndex((col) => col.id === column.id)
    handleCellHover({
      event: e,
      row: row!,
      column,
      value: row?.row[column.title],
      mousePosition,
      pk,
      selected: activeCell.value.row === rowIndex && activeCell.value.column === colIndex,
      imageLoader,
    })
  }
}

const reloadViewDataHookHandler = async (param) => {
  if (param?.fieldAdd) {
    containerRef.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }
  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)

  await syncCount()

  calculateSlices()

  await Promise.all([updateVisibleRows()])

  triggerRefreshCanvas()
}

let rafnId: number | null = null

useScroll(containerRef, {
  behavior: 'instant',
  onScroll: (e) => {
    if (rafnId) cancelAnimationFrame(rafnId)

    rafnId = requestAnimationFrame(() => {
      scrollTop.value = e.target.scrollTop
      scrollLeft.value = e.target.scrollLeft
      calculateSlices()
      triggerRefreshCanvas()
    })
  },
})

const triggerReload = () => {
  calculateSlices()
  updateVisibleRows()
}

async function expandRows({
  newRows,
  newColumns,
  cellsOverwritten,
  rowsUpdated,
}: {
  newRows: number
  newColumns: number
  cellsOverwritten: number
  rowsUpdated: number
}) {
  isExpandTableModalOpen.value = true
  const options = {
    continue: false,
    expand: true,
  }
  const { close } = useDialog(resolveComponent('DlgRecordUpsert'), {
    'modelValue': isExpandTableModalOpen,
    'newRows': newRows,
    'newColumns': newColumns,
    'cellsOverwritten': cellsOverwritten,
    'rowsUpdated': rowsUpdated,
    'onUpdate:expand': closeDialog,
    'onUpdate:modelValue': closeDlg,
  })
  function closeDlg() {
    isExpandTableModalOpen.value = false
    close(1000)
  }
  async function closeDialog(expand: boolean) {
    options.continue = true
    options.expand = expand
    close(1000)
  }
  await until(isExpandTableModalOpen).toBe(false)
  return options
}

async function saveEmptyRow(rowObj: Row, before?: string) {
  await updateOrSaveRow?.(rowObj, null, null, { metaValue: meta.value, viewMetaValue: view.value }, before)
}

function addEmptyColumn() {
  if (!isAddingColumnAllowed.value) return
  $e('c:shortcut', { key: 'ALT + C' })
  containerRef.value?.scrollTo({ left: totalWidth.value, behavior: 'smooth' })

  isCreateOrEditColumnDropdownOpen.value = true

  const totalColumnsWidth = columns.value.reduce((acc, col) => acc + parseInt(col.width, 10), 0)
  const plusColumnX = totalColumnsWidth - scrollLeft.value

  overlayStyle.value = {
    top: `calc(100svh + 32px)`,
    left: `calc(100svw + ${plusColumnX - 200}px)`,
    width: `${width.value}px`,
    height: `${height.value}px`,
    position: 'fixed',
  }

  isDropdownVisible.value = true
  triggerRefreshCanvas()
}

function handleEditColumn(_e: MouseEvent, isDescription = false, column: ColumnType) {
  if (isLocked.value) return
  if (
    isUIAllowed('fieldEdit') &&
    !isMobileMode.value &&
    (!isMetaReadOnly.value || readonlyMetaAllowedTypes.includes(column.uidt))
  ) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (isDescription) {
      isEditColumnDescription.value = true
    }

    const colIndex = columns.value.findIndex((col) => col.id === column.id)
    let xOffset = 0
    for (let i = colSlice.value.start; i < colIndex; i++) {
      xOffset += parseInt(columns.value[i]!.width, 10)
    }
    overlayStyle.value = {
      top: `${rect.top}px`,
      left: `${xOffset + rect.left}px`,
      width: columns.value[colIndex]!.width,
      height: '32px',
      position: 'fixed',
    }

    openColumnDropdownField.value = false
    editColumn.value = column
    isDropdownVisible.value = true
    isCreateOrEditColumnDropdownOpen.value = true
  }
}

async function addEmptyRow(row?: number, skipUpdate = false, before?: string) {
  clearInvalidRows?.()
  if (rowSortRequiredRows.value.length) {
    applySorting?.(rowSortRequiredRows.value)
  }

  const rowObj = callAddEmptyRow?.(row)

  if (!skipUpdate && rowObj) {
    saveEmptyRow(rowObj, before)
  }

  nextTick().then(() => {
    scrollToCell(row ?? totalRows.value - 1, 0)
  })

  return rowObj
}

const callAddNewRow = (context: { row: number; col: number }, direction: 'above' | 'below') => {
  const row = cachedRows.value.get(direction === 'above' ? context.row : context.row + 1)

  if (row) {
    const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
    addEmptyRow(context.row + (direction === 'above' ? 0 : 1), false, rowId)
  } else {
    addEmptyRow()
  }
}

const onNavigate = (dir: NavigateDir) => {
  if (activeCell.value.row === null || activeCell.value.column === null) return

  editEnabled.value = null
  selection.value.clear()

  switch (dir) {
    case NavigateDir.NEXT:
      if (activeCell.value.row < totalRows.value - 1) {
        activeCell.value.row++
      } else {
        addEmptyRow()
        activeCell.value.row++
      }
      break
    case NavigateDir.PREV:
      if (activeCell.value.row > 0) {
        activeCell.value.row--
      }
      break
  }

  requestAnimationFrame(triggerRefreshCanvas)

  nextTick(() => {
    scrollToCell()
  })
}

watch([height, width], () => {
  containerSize.value = { height: height.value, width: width.value }
  requestAnimationFrame(() => {
    requestAnimationFrame(triggerRefreshCanvas)
  })
})

reloadViewDataHook.on(reloadViewDataHookHandler)
reloadVisibleDataHook?.on(triggerReload)

onMounted(async () => {
  clearTextCache()
  await syncCount()
  calculateSlices()
  triggerRefreshCanvas()
  await loadViewAggregate()
})

onBeforeUnmount(() => {
  reloadViewDataHook.off(reloadViewDataHookHandler)
  reloadVisibleDataHook?.off(triggerReload)
})

const editEnabledCellPosition = computed(() => {
  if (!editEnabled.value) {
    return {
      top: 0,
      left: 0,
    }
  }

  return {
    top: `${Math.max(
      32,
      Math.min(containerRef.value?.clientHeight - rowHeight.value - 36, editEnabled.value.y - scrollTop.value - rowHeight.value),
    )}px`,
    left: `${
      editEnabled.value.fixed
        ? editEnabled.value.x
        : Math.max(
            fixedLeftWidth.value,
            Math.min(containerRef.value?.clientWidth - editEnabled.value.width - 18, editEnabled.value.x - scrollLeft.value),
          )
    }px`,
  }
})
</script>

<template>
  <div ref="wrapperRef" class="w-full h-full">
    <div
      v-if="isBulkOperationInProgress"
      class="absolute h-full flex items-center justify-center z-70 w-full inset-0 bg-white/30"
    >
      <GeneralLoader size="regular" />
    </div>
    <div ref="containerRef" class="relative w-full h-full overflow-auto border border-gray-200">
      <div
        class="relative"
        :style="{
          height: `${totalHeight}px`,
          width: `${totalWidth}px`,
        }"
      >
        <Tooltip />
        <NcDropdown
          v-model:visible="isContextMenuOpen"
          :disabled="contextMenuTarget === null && !selectedRows.length && !vSelectedAllRecords"
          :trigger="['contextmenu']"
          overlay-class-name="nc-dropdown-grid-context-menu"
        >
          <canvas
            ref="canvasRef"
            class="sticky top-0 left-0"
            :height="`${height}px`"
            :width="`${width}px`"
            oncontextmenu="return false"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
          >
          </canvas>
          <template #overlay>
            <SmartsheetGridCanvasContextCell
              v-model:context-menu-target="contextMenuTarget"
              v-model:selected-all-records="vSelectedAllRecords"
              :total-rows="totalRows"
              :selection="selection"
              :columns="columns"
              :cached-rows="cachedRows"
              :active-cell="activeCell"
              :action-manager="actionManager"
              :clear-cell="clearCell"
              :is-primary-key-available="isPrimaryKeyAvailable"
              :is-selection-read-only="isSelectionReadOnly"
              :is-selection-only-a-i="isSelectedOnlyAI"
              :is-selection-only-script="isSelectedOnlyScript"
              :is-insert-below-disabled="isInsertBelowDisabled"
              :is-order-column-exists="isOrderColumnExists"
              :delete-row="deleteRow"
              :delete-range-of-rows="deleteRangeOfRows"
              :delete-selected-rows="deleteSelectedRows"
              :bulk-delete-all="bulkDeleteAll"
              :call-add-new-row="callAddNewRow"
              :copy-value="copyValue"
              :bulk-update-rows="bulkUpdateRows"
              :expand-form="expandForm"
              :selected-rows="selectedRows"
              :clear-selected-range-of-cells="clearSelectedRangeOfCells"
              @click="isContextMenuOpen = false"
              @bulk-update-dlg="emits('bulkUpdateDlg')"
            />
          </template>
        </NcDropdown>
        <div class="absolute pointer-events-none inset-0">
          <div
            v-if="editEnabled?.row"
            :key="editEnabled?.rowIndex"
            :style="{
              top: editEnabledCellPosition.top,
              left: editEnabledCellPosition.left,
              width: `${editEnabled.width}px`,
              minHeight: `${editEnabled.minHeight}px`,
              height: `${editEnabled.height}px`,
              borderRadius: '2px',
              willChange: 'top, bottom, left, width, height',
            }"
            class="nc-canvas-table-editable-cell-wrapper pointer-events-auto"
            :class="{ 'px-2.5': !noPadding, [`row-height-${rowHeightEnum ?? 1}`]: true }"
          >
            <SmartsheetRow :row="editEnabled.row">
              <template #default="{ state }">
                <SmartsheetVirtualCell
                  v-if="isVirtualCol(editEnabled.column) && editEnabled.column.title"
                  v-model="editEnabled.row.row[editEnabled.column.title]"
                  :column="editEnabled.column"
                  :row="editEnabled.row"
                  active
                  @save="updateOrSaveRow?.(editEnabled.row, editEnabled.column.title, state)"
                  @navigate="onNavigate"
                />
                <SmartsheetCell
                  v-else
                  v-model="editEnabled.row.row[editEnabled.column.title]"
                  :column="editEnabled.column"
                  :row-index="editEnabled.rowIndex"
                  active
                  edit-enabled
                  @save="updateOrSaveRow?.(...$event)"
                  @save-with-state="updateOrSaveRow?.(...$event)"
                  @navigate="onNavigate"
                />
              </template>
            </SmartsheetRow>
          </div>
        </div>
      </div>
      <template v-if="overlayStyle">
        <NcDropdown
          :visible="isDropdownVisible"
          :overlay-class-name="`!bg-transparent ${
            !openAggregationField && !openColumnDropdownField ? '!border-none !shadow-none' : ''
          }`"
          @visible-change="onVisibilityChange"
        >
          <div :style="overlayStyle" class="hide pointer-events-none"></div>
          <template #overlay>
            <Aggregation v-if="openAggregationField" v-model:column="openAggregationField" />
            <SmartsheetHeaderColumnMenu
              v-else-if="openColumnDropdownField"
              v-model:is-open="isDropdownVisible"
              :column="openColumnDropdownField"
              @edit="handleEditColumn"
            />
            <div v-if="isCreateOrEditColumnDropdownOpen" class="nc-edit-or-add-provider-wrapper">
              <LazySmartsheetColumnEditOrAddProvider
                :key="editColumn?.id || 'new'"
                ref="columnEditOrAddProviderRef"
                :column="editColumn"
                :edit-description="isEditColumnDescription"
                @submit="closeAddColumnDropdownMenu(true)"
                @cancel="closeAddColumnDropdownMenu()"
                @click.stop
                @keydown.stop
              />
            </div>
          </template>
        </NcDropdown>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-canvas-table-editable-cell-wrapper {
  @apply sticky bg-white border-2 !rounded border-[#3366ff] !text-small !leading-[18px] overflow-hidden;

  &.row-height-1 {
    :deep(.nc-multi-select) {
      height: 28px !important;
    }

    :deep(.nc-single-select) {
      height: 30px !important;
    }

    :deep(.nc-cell-attachment) {
      @apply !pt-0;

      .nc-upload-btn {
        @apply !pt-0.5;
      }

      .nc-attachment-wrapper {
        height: 28px !important;
        @apply !pt-0.5 !pb-0.5;
      }
    }

    :deep(.nc-cell-longtext) {
      .nc-readonly-rich-text-wrapper {
        @apply !pl-2 pt-0.5;
      }

      .nc-text-area-expand-btn {
        @apply !pr-1 !pt-1;
      }
    }

    :deep(.nc-cell-datetime) {
      @apply !py-0.75 !px-2;
    }
  }

  :deep(.nc-cell-longtext) {
    .nc-readonly-rich-text-wrapper {
      @apply !pl-2 pt-0.5;
    }

    .nc-text-area-expand-btn {
      @apply !pr-1 !pt-1;
    }
  }

  :deep(.nc-cell-attachment) {
    [data-row-height='1'] {
      @apply -mt-[2px];
      .empty-add-files {
        @apply mt-[3px];
      }
    }
    [data-row-height]:not([data-row-height='1']) {
      button.add-files,
      button.view-attachments {
        @apply mt-[4px];
      }
    }
  }
  :deep(.nc-single-select) {
    @apply !h-auto !px-2;
  }

  :deep(.nc-cell-singlelinetext),
  :deep(.nc-cell-number),
  :deep(.nc-cell-url),
  :deep(.nc-cell-user),
  :deep(.nc-cell-geometry),
  :deep(.nc-multi-select),
  :deep(.nc-cell-decimal),
  :deep(.nc-cell-currency) {
    @apply !h-auto;
  }
  :deep(.nc-cell-json) {
    @apply !py-1;
  }

  :deep(.nc-cell-datetime) {
    @apply !py-1 !px-2;
  }
  :deep(.nc-cell-date),
  :deep(.nc-cell-year),
  :deep(.nc-cell-time) {
    @apply !h-auto !py-1;
  }

  .nc-cell,
  .nc-virtual-cell {
    @apply !text-small !leading-[18px];

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-small leading-[18px];

      &:not(.ant-select-selection-search-input) {
        @apply !text-small leading-[18px];
      }
    }
  }
}
</style>
