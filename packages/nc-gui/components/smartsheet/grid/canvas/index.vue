<script setup lang="ts">
import {
  type ColumnType,
  type TableType,
  UITypes,
  type ViewType,
  isLinksOrLTAR,
  isVirtualCol,
  readonlyMetaAllowedTypes,
} from 'nocodb-sdk'
import type { CellRange } from '../../../../composables/useMultiSelect/cellRange'
import { IsCanvasInjectionInj } from '../../../../context'
import { useCanvasTable } from './composables/useCanvasTable'
import Aggregation from './context/Aggregation.vue'
import { clearTextCache } from './utils/canvas'
import Tooltip from './Tooltip.vue'
import { columnTypeName } from './utils/headerUtils'
import { NO_EDITABLE_CELL } from './utils/cell'

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

const paddingLessUITypes = new Set([UITypes.LongText, UITypes.DateTime])

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

const totalHeight = computed(() => {
  const rowsHeight = totalRows.value * rowHeight.value
  const headerHeight = 32
  return rowsHeight + headerHeight + 256
})

const isContextMenuOpen = computed({
  get: () => {
    if (selectedRows.value.length && isDataReadOnly.value) return false
    return _isContextMenuOpen.value
  },
  set: (val) => {
    _isContextMenuOpen.value = val
  },
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
  const newEndRow = Math.min(totalRows.value, Math.max(endRowIndex, startRowIndex + 50))

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

const onVisibilityChange = () => {
  if (isCreateOrEditColumnDropdownOpen.value) {
    isDropdownVisible.value = columnEditOrAddProviderRef.value?.shouldKeepModalOpen()
    isCreateOrEditColumnDropdownOpen.value = columnEditOrAddProviderRef.value?.shouldKeepModalOpen()
  }
}

function closeAddColumnDropdownMenu(scrollToLastCol = false) {
  isCreateOrEditColumnDropdownOpen.value = false
  isDropdownVisible.value = false
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
  const isAtMaxSelection = selectedRows.value.length >= 100
  const isCheckboxDisabled = vSelectedAllRecords.value
  const isChecked = row.rowMeta?.selected || vSelectedAllRecords.value

  const regions = []
  let currentX = 4
  let isCheckboxRendered = false

  if (isChecked) {
    regions.push({
      x: currentX,
      width: 24,
      action: isCheckboxDisabled ? 'none' : 'select',
    })
    isCheckboxRendered = true
    currentX += 24
  } else {
    regions.push({
      x: currentX,
      width: 24,
      action: isRowReOrderEnabled.value ? 'reorder' : 'none',
    })
    currentX += 24
  }

  if ((!isAtMaxSelection || row.rowMeta?.selected) && !isCheckboxDisabled && !isCheckboxRendered) {
    regions.push({
      x: currentX,
      width: 24,
      action: 'select',
    })
    currentX += 24
  }

  regions.push({
    x: currentX,
    width: 24,
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

  if (y < 32) {
    const totalColumnsWidth = columns.value.reduce((acc, col) => acc + parseInt(col.width, 10), 0)
    const plusColumnX = totalColumnsWidth - scrollLeft.value
    const plusColumnWidth = 60

    if (x >= plusColumnX && x <= plusColumnX + plusColumnWidth) {
      isCreateOrEditColumnDropdownOpen.value = true
      overlayStyle.value = {
        top: `calc(100svh - ${height.value}px + 32px)`,
        left: `calc(100svw - ${width.value}px + ${plusColumnX - 200}px)`,
      }
      isDropdownVisible.value = true
      triggerRefreshCanvas()
      return
    }
  }

  // Column Dropdown Menu
  if (y < 32 && (e.button === 2 || e.detail === 2)) {
    const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)
    if (clickedColumn) {
      if (e.button === 2) {
        openColumnDropdownField.value = clickedColumn.columnObj
        isDropdownVisible.value = true
        overlayStyle.value = {
          top: `calc(100svh - ${height.value}px + ${32}px)`,
          minWidth: `${clickedColumn.width}`,
          width: `${clickedColumn.width}`,
          left: `calc(100svw - ${width.value}px + ${xOffset}px)`,
        }
      } else if (e.detail === 2) {
        handleEditColumn(e, false, clickedColumn.columnObj)
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
        top: `${height.value - 162}px`,
        minWidth: `${clickedColumn.width}`,
        width: `${clickedColumn.width}`,
        left: `calc(100svw - ${width.value}px + ${xOffset}px)`,
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
  }

  if (e.detail === 1 && x < 80) {
    const row = cachedRows.value.get(rowIndex)
    if (!row) return
    handleRowMetaClick({ e, row, x })
    return
  }

  onMouseDownFillHandlerStart(e)
  if (isFillHandlerActive.value) return

  if (e.button !== 2) {
    // If not right click, clear the selection
    selection.value.clear()
  }

  if (y <= 32) {
    // Column Resize
    startResize(e)
    await nextTick(() => {
      if (!resizeableColumn.value) {
        startDrag(e.clientX - rect.left)
        triggerRefreshCanvas()
      }
    })
  } else {
    // Row Selection
    if (rowIndex < rowSlice.value.start || rowIndex >= rowSlice.value.end) {
      activeCell.value.row = -1
      activeCell.value.column = -1
      triggerRefreshCanvas()
    }

    const { column: clickedColumn } = findClickedColumn(x, scrollLeft.value)
    if (clickedColumn) {
      if (rowIndex !== activeCell.value?.row) {
        onActiveCellChanged()
      }
      activeCell.value.row = rowIndex
      activeCell.value.column = columns.value.findIndex((col) => col.id === clickedColumn.id)
      if (e.button === 2) {
        const columnIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)
        const isWithinSelection = selection.value.isCellInRange({ row: rowIndex, col: columnIndex })

        if (!isWithinSelection) {
          selection.value.clear()
          selection.value.startRange({ row: rowIndex, col: columnIndex })
          selection.value.endRange({ row: rowIndex, col: columnIndex })
        }

        contextMenuTarget.value = { row: rowIndex, col: columnIndex }
        nextTick(() => {
          isContextMenuOpen.value = true
        })
        triggerRefreshCanvas()
        return
      } else {
        const row = cachedRows.value.get(rowIndex)
        const pk = extractPkFromRow(row?.row, meta.value?.columns as ColumnType[])
        if (row) {
          const colIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)
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
          triggerRefreshCanvas()

          if (res) return
        }
      }
      const columnUIType = clickedColumn.columnObj.uidt as UITypes
      if (NO_EDITABLE_CELL.includes(columnUIType)) {
        onMouseDownSelectionHandler(e)
      } else if (e.detail === 2 && columnUIType === UITypes.Lookup) {
        makeCellEditable(rowIndex, clickedColumn)
      } else if (e.detail === 2 || (e.detail === 1 && clickedColumn?.virtual && !isButton({ uidt: columnUIType }))) {
        const supportedVirtuals = [UITypes.Barcode, UITypes.QrCode]
        if (!supportedVirtuals.includes(columnUIType) && clickedColumn?.virtual && !isLinksOrLTAR(clickedColumn.columnObj)) return
        makeCellEditable(rowIndex, clickedColumn)
      } else {
        onMouseDownSelectionHandler(e)
      }
      triggerRefreshCanvas()
    }
  }
}

function scrollToCell(row?: number, column?: number) {
  if (!containerRef.value) return

  row = row ?? activeCell.value.row
  column = column ?? activeCell.value.column

  if (!row || !column) return

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

const handleMouseUp = (e: MouseEvent) => {
  e.preventDefault()
  onMouseUpFillHandlerEnd()
  onMouseUpSelectionHandler(e)
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

    const canvas = new OffscreenCanvas(0, 0)

    const ctx = canvas.getContext('2d')!
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
    top: `calc(100svh - ${height.value}px + 32px)`,
    left: `calc(100svw - ${width.value}px + ${plusColumnX - 200}px)`,
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
    if (isDescription) {
      isEditColumnDescription.value = true
    }

    const colIndex = columns.value.findIndex((col) => col.id === column.id)
    let xOffset = 0
    for (let i = colSlice.value.start; i < colIndex; i++) {
      xOffset += parseInt(columns.value[i]!.width, 10)
    }
    overlayStyle.value = {
      top: `calc(100svh - ${height.value}px + ${32}px)`,
      left: `calc(100svw - ${width.value}px + ${xOffset}px)`,
    }

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
            />
          </template>
        </NcDropdown>
      </div>
      <div
        v-if="editEnabled?.row"
        :key="editEnabled?.rowIndex"
        :style="{
          top: `${rowHeight * editEnabled.rowIndex + 32}px`,
          left: `${editEnabled.x + (editEnabled.fixed ? scrollLeft : 0)}px`,
          width: `${editEnabled.width}px`,
          minHeight: `${editEnabled.minHeight}px`,
          height: `${editEnabled.height}px`,
          borderRadius: '2px',
        }"
        class="nc-canvas-table-editable-cell-wrapper"
        :class="{ 'px-2.5': !noPadding, [`row-height-${rowHeightEnum ?? 1}`]: true }"
      >
        <LazySmartsheetRow :row="editEnabled.row">
          <template #default="{ state }">
            <LazySmartsheetVirtualCell
              v-if="isVirtualCol(editEnabled.column) && editEnabled.column.title"
              v-model="editEnabled.row.row[editEnabled.column.title]"
              :column="editEnabled.column"
              :row="editEnabled.row"
              active
              @save="updateOrSaveRow?.(editEnabled.row, editEnabled.column.title, state)"
            />
            <SmartsheetCell
              v-else
              v-model="editEnabled.row.row[editEnabled.column.title]"
              :column="editEnabled.column"
              :row-index="editEnabled.rowIndex"
              active
              edit-enabled
              @save="updateOrSaveRow?.(editEnabled.row, editEnabled.column.title, state)"
            />
          </template>
        </LazySmartsheetRow>
      </div>

      <template v-if="overlayStyle">
        <NcDropdown :visible="isDropdownVisible" :overlay-style="overlayStyle" @visible-change="onVisibilityChange">
          <div></div>
          <template #overlay>
            <Aggregation v-if="openAggregationField" v-model:column="openAggregationField" />
            <SmartsheetHeaderColumnMenu
              v-if="openColumnDropdownField"
              v-model:is-open="isDropdownVisible"
              :column="openColumnDropdownField"
              @edit="handleEditColumn"
            />
            <div v-if="isCreateOrEditColumnDropdownOpen" class="nc-edit-or-add-provider-wrapper">
              <LazySmartsheetColumnEditOrAddProvider
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
  @apply absolute bg-white border-2 !rounded border-[#3366ff] !text-small !leading-[18px];

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

  :deep(.nc-multi-select) {
    @apply !h-auto;
  }

  :deep(.nc-single-select) {
    @apply !h-auto;
  }

  :deep(.nc-cell-datetime) {
    @apply !py-1 !px-2;
  }
  :deep(.nc-cell-date) {
    @apply !h-auto !py-1;
  }

  :deep(.nc-cell-time) {
    @apply !h-auto !py-1;
  }
  :deep(.nc-cell-year) {
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
