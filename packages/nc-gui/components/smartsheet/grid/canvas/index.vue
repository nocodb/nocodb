<script setup lang="ts">
import {
  type ColumnReqType,
  type ColumnType,
  PlanLimitTypes,
  type TableType,
  UITypes,
  type ViewType,
  isVirtualCol,
  readonlyMetaAllowedTypes,
} from 'nocodb-sdk'
import { flip, offset, shift, useFloating } from '@floating-ui/vue'
import axios from 'axios'
import type { CSSProperties, ComputedRef, Ref } from 'vue'
import type { CellRange } from '../../../../composables/useMultiSelect/cellRange'
import { hasAncestorWithClass, isGeneralOverlayActive } from '../../../../utils/browserUtils'
import type { CanvasGroup } from '../../../../lib/types'
import { useCanvasTable } from './composables/useCanvasTable'
import Aggregation from './context/Aggregation.vue'
import { clearTextCache, defaultOffscreen2DContext, isBoxHovered, renderSingleLineText } from './utils/canvas'
import Tooltip from './components/Tooltip.vue'
import Scroller from './components/Scroller.vue'
import { columnTypeName } from './utils/headerUtils'
import { MouseClickType, NO_EDITABLE_CELL, getMouseClickType, parseCellWidth } from './utils/cell'
import {
  ADD_NEW_COLUMN_WIDTH,
  AGGREGATION_HEIGHT,
  COLUMN_HEADER_HEIGHT_IN_PX,
  GROUP_HEADER_HEIGHT,
  GROUP_PADDING,
  MAX_SELECTED_ROWS,
  ROW_META_COLUMN_WIDTH,
} from './utils/constants'
import { calculateGroupRowTop, comparePath, findGroupByPath, generateGroupPath, getDefaultGroupData } from './utils/groupby'
import { CanvasElement, ElementTypes } from './utils/CanvasElement'
import AddNewRowMenu from './components/AddNewRowMenu.vue'
import type { Row } from '#imports'

const props = defineProps<{
  totalRows: number
  actualTotalRows: number
  data: Map<number, Row>
  groupDataCache: Map<
    string,
    {
      cachedRows: Ref<Map<number, Row>>
      chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
      totalRows: Ref<number>
      selectedRows: ComputedRef<Array<Row>>
      isRowSortRequiredRows: ComputedRef<Array<Row>>
    }
  >
  rowHeightEnum?: number
  loadData: (params?: any, shouldShowLoading?: boolean, path?: Array<number>) => Promise<Array<Row>>
  callAddEmptyRow?: (
    newRowIndex?: number,
    metaValue?: TableType,
    rowOverwrite?: Record<string, any>,
    path?: Array<number>,
  ) => Row | undefined
  deleteRow?: (rowIndex: number, undo?: boolean, path?: Array<number>) => Promise<void>
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
    path?: Array<number>,
  ) => Promise<any>
  deleteSelectedRows: (path?: Array<number>) => Promise<void>
  clearInvalidRows?: (path?: Array<number>) => void
  deleteRangeOfRows: (cellRange: CellRange, path?: Array<number>) => Promise<void>
  updateRecordOrder: (
    originalIndex: number,
    targetIndex: number | null,
    undo?: boolean,
    isFailed?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  bulkDeleteAll: (path?: Array<number>) => Promise<void>
  bulkUpsertRows: (
    insertRows: Row[],
    updateRows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    newColumns?: Partial<ColumnType>[],
    undo?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean, path: Array<number>) => void
  removeRowIfNew: (row: Row, path?: Array<number>) => void
  rowSortRequiredRows: Row[]
  applySorting?: (newRows?: Row | Row[], path?: Array<number>) => void
  clearCache: (visibleStartIndex: number, visibleEndIndex: number, path?: Array<number>) => void
  syncCount: (path?: Array<number>) => Promise<void>
  selectedRows: Array<Row>
  chunkStates: Array<'loading' | 'loaded' | undefined>
  isBulkOperationInProgress: boolean
  selectedAllRecords?: boolean
  getRows: (start: number, end: number, path?: Array<number>) => Promise<Row[]>
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
    isGroupChanged?: ComputedRef<Array<Row>>
  }
  cachedGroups: Map<number, CanvasGroup>
  totalGroups: number
  groupByColumns: Array<{
    column: ColumnType
    order?: number
    sort: string
  }>
  toggleExpand: (group: CanvasGroup) => void
  groupSyncCount: (group?: CanvasGroup) => Promise<void>
  fetchMissingGroupChunks: (startIndex: number, endIndex: number, parentGroup?: CanvasGroup) => Promise<void>
  clearGroupCache: (startIndex: number, endIndex: number, parentGroup?: CanvasGroup) => void
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
  removeRowIfNew,
  getRows,
  getDataCache,
  toggleExpand,
  groupSyncCount: syncGroupCount,
  fetchMissingGroupChunks,
  clearGroupCache,
} = props

// VModels
const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

const { eventBus, isSqlView } = useSmartsheetStoreOrThrow()

const { withLoading } = useLoadingTrigger()

const { showRecordPlanLimitExceededModal, navigateToPricing } = useEeConfig()

// Props to Refs
const totalRows = toRef(props, 'totalRows')
const actualTotalRows = toRef(props, 'actualTotalRows')
const totalGroups = toRef(props, 'totalGroups')
const chunkStates = toRef(props, 'chunkStates')
const cachedRows = toRef(props, 'data')
const cachedGroups = toRef(props, 'cachedGroups')
const rowHeightEnum = toRef(props, 'rowHeightEnum')
const selectedRows = toRef(props, 'selectedRows')
const rowSortRequiredRows = toRef(props, 'rowSortRequiredRows')
const groupByColumns = toRef(props, 'groupByColumns')
const groupDataCache = toRef(props, 'groupDataCache')

// Refs
const wrapperRef = ref()
const scrollTop = ref(0)
const scrollLeft = ref(0)
const preloadColumn = ref<any>()
const overlayStyle = ref<Record<string, any> | null>(null)
const openAggregationField = ref<CanvasGridColumn | null>(null)
const openAddNewRowDropdown = ref<Array<number> | null>(null)
const openColumnDropdownField = ref<ColumnType | null>(null)
const isDropdownVisible = ref(false)
const contextMenuTarget = ref<{ row: number; col: number; path: Array<number> } | null>(null)
const _isContextMenuOpen = ref(false)
const isCreateOrEditColumnDropdownOpen = ref(false)
const columnEditOrAddProviderRef = ref()
const editColumn = ref<ColumnType | null>(null)
const lastOpenColumnDropdownField = ref<ColumnType | null>(null)
const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)
const isEditColumnDescription = ref(false)
const mousePosition = reactive({ x: 0, y: 0 })
const clientMousePosition = reactive({ clientX: 0, clientY: 0 })
const paddingLessUITypes = new Set([
  UITypes.LongText,
  UITypes.DateTime,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.Formula,
])
const scroller = ref()
provide(ClientMousePositionInj, clientMousePosition)
// provide the column ref since at a time only one column can be active
// and this need to avail the column ref inside modals(delete, duplicate,... etc) even after closing menu
provide(CanvasColumnInj, lastOpenColumnDropdownField)

const selectCellHook = createEventHook()
provide(CanvasSelectCellInj, selectCellHook)

const activeCellElement = ref<HTMLElement>()

const cellClickHook = createEventHook()

const cellEventHook = createEventHook()

provide(CellClickHookInj, cellClickHook)

provide(CellEventHookInj, cellEventHook)

provide(CurrentCellInj, activeCellElement)

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const isExpandTableModalOpen = ref(false)
// Injections
const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const reloadVisibleDataHook = inject(ReloadVisibleDataHookInj, undefined)
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())
const isPublicView = inject(IsPublicInj, ref(false))
const isLocked = inject(IsLockedInj, ref(false))

// Composables
const { height, width } = useElementSize(wrapperRef)
const { height: windowHeight, width: windowWidth } = useWindowSize()
const { aggregations, loadViewAggregate } = useViewAggregateOrThrow()
const { isDataReadOnly, isUIAllowed, isMetaReadOnly } = useRoles()
const { isMobileMode, isAddNewRecordGridMode, setAddNewRecordGridMode, appInfo } = useGlobal()
const route = useRoute()
const { $e } = useNuxtApp()
const { t } = useI18n()
const tooltipStore = useTooltipStore()
const { targetReference, placement } = storeToRefs(tooltipStore)
const tooltipRef = ref()
const { floatingStyles } = useFloating(targetReference, tooltipRef, {
  placement,
  middleware: [offset(8), flip(), shift({ padding: 5 })],
})
const { tryShowTooltip, hideTooltip } = tooltipStore

let selectedRowInfo: { index: number | null | undefined; path: Array<number> } = {
  index: null,
  path: [],
}

const {
  isGroupBy,

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
  makeCellEditable,
  findClickedColumn,
  findColumnPosition,
  elementMap,
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
  isRowReorderActive,

  // Order Column
  isOrderColumnExists,
  isInsertBelowDisabled,

  // Meta Information
  isPrimaryKeyAvailable,
  meta,
  view,
  isAddingColumnAllowed,
  isAddingEmptyRowAllowed,
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
  readOnly,
  baseRoleLoader,

  // column resize related refs
  colResizeHoveredColIds,
  totalColumnsWidth,

  isFieldEditAllowed,
  isContextMenuAllowed,
  isDataEditAllowed,
  removeInlineAddRecord,
  upgradeModalInlineState,
  isRowDraggingEnabled,
} = useCanvasTable({
  rowHeightEnum,
  cachedRows,
  mousePosition,
  clearCache,
  chunkStates,
  totalRows,
  actualTotalRows,
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
  setCursor,
  getRows,
  cachedGroups,
  toggleExpand,
  totalGroups,
  groupSyncCount: syncGroupCount,
  groupByColumns,
  fetchMissingGroupChunks,
  getDataCache,
})

const activeCursor = ref<CursorType>('auto')

function setCursor(cursor: CursorType, customCondition?: (prevValue: CursorType) => boolean) {
  if (customCondition && !customCondition(activeCursor.value)) return

  /**
   * Their might be the that while dragging row we hover over another element, at that cursor type will be different
   * So we have set cursor again
   */
  if (isRowReorderActive.value) {
    cursor = 'grabbing'
  }

  if (activeCursor.value !== cursor) {
    activeCursor.value = cursor
    if (canvasRef.value && canvasRef.value.style?.cursor !== cursor) canvasRef.value.style.cursor = cursor
  }
}

// Computed
const noPadding = computed(() => paddingLessUITypes.has(editEnabled.value?.column.uidt as UITypes))

const containerRef = computed(() => scroller.value?.wrapperRef)

const fixedLeftWidth = computed(() => {
  return columns.value.filter((col) => col.fixed).reduce((sum, col) => sum + parseCellWidth(col.width), 0)
})

const isClamped = computed(() => {
  if (!editEnabled.value || !containerRef.value)
    return {
      verticalStuck: false,
      horizontalStuck: false,
      isStuck: false,
    }

  if (editEnabled.value.column?.uidt === UITypes.LongText || editEnabled.value.column?.uidt === UITypes.Formula) {
    return {
      verticalStuck: true,
      horizontalStuck: true,
      isStuck: true,
    }
  }

  const rawTop = editEnabled.value.y - scrollTop.value - rowHeight.value + 1
  const clampedTop = Math.max(32, Math.min(containerRef.value.clientHeight - rowHeight.value - 36, rawTop))
  const verticalStuck = clampedTop !== rawTop

  let horizontalStuck = false

  if (!editEnabled.value.fixed) {
    const rawLeft = editEnabled.value.x - scrollLeft.value
    const clampedLeft = Math.max(
      fixedLeftWidth.value,
      Math.min(containerRef.value.clientWidth - editEnabled.value.width, rawLeft),
    )
    horizontalStuck = clampedLeft !== rawLeft
  }

  return {
    verticalStuck,
    horizontalStuck,
    isStuck: verticalStuck || horizontalStuck,
  }
})

const editEnabledCellPosition = computed(() => {
  if (!editEnabled.value) {
    return {
      top: 0,
      left: 0,
    }
  }

  const top = Math.max(
    COLUMN_HEADER_HEIGHT_IN_PX - 1,
    Math.min(
      containerRef.value?.clientHeight - rowHeight.value - AGGREGATION_HEIGHT,
      editEnabled.value.y - scrollTop.value - rowHeight.value,
    ),
  )

  const left = editEnabled.value.fixed
    ? editEnabled.value.x
    : Math.max(
        fixedLeftWidth.value,
        Math.min(containerRef.value?.clientWidth - editEnabled.value.width, editEnabled.value.x - scrollLeft.value),
      )

  return {
    top: `${top + (isClamped.value.horizontalStuck && !isGroupBy.value ? 1 : 0)}px`,
    left: `${left + (isClamped.value.isStuck && editEnabled.value?.fixed ? -1 : 0)}px`,
  }
})

const totalHeight = computed(() => {
  const additionalPadding = removeInlineAddRecord.value ? 412 : 256

  // For non-grouped view, use original calculation
  if (!isGroupBy.value) {
    const dataCache = getDataCache()
    return dataCache.totalRows.value * rowHeight.value + 32 + additionalPadding
  }

  // Add height for all top-level groups
  const rootGroupsHeight = totalGroups.value * (GROUP_HEADER_HEIGHT + GROUP_PADDING)

  function estimateTotalHeight(groups: Map<number, CanvasGroup>): number {
    let sum = 0
    // Add height for each expanded group's contents
    for (const [, group] of groups) {
      if (group?.isExpanded) {
        // For leaf groups (with rows)
        if (group.path) {
          sum += group.count * rowHeight.value

          if (isAddingEmptyRowAllowed.value && !removeInlineAddRecord.value) {
            sum += COLUMN_HEADER_HEIGHT_IN_PX
          }
          // 1 Px Offset is Added for Showing the activeBorders. Else it wont be visible
          sum += 1
        } else if (group?.groups) {
          sum += (group?.groupCount ?? 0) * (GROUP_HEADER_HEIGHT + GROUP_PADDING)
          // Do nested groups check
          sum += estimateTotalHeight(group.groups)
        }
      }
    }
    return sum
  }

  return rootGroupsHeight + estimateTotalHeight(cachedGroups.value) + 32 + additionalPadding // Additional padding
})

const isContextMenuOpen = computed({
  get: () => {
    if (
      (selectedRows.value.length && isDataReadOnly.value) ||
      isDropdownVisible.value ||
      (contextMenuTarget.value === null && !selectedRows.value.length && !vSelectedAllRecords.value)
    ) {
      return false
    }
    return _isContextMenuOpen.value
  },
  set: (val) => {
    _isContextMenuOpen.value = val
  },
})

function resetRowSelection() {
  if (!selectedRows.value.length && !vSelectedAllRecords.value) return

  const dataCache = getDataCache()
  dataCache.cachedRows.value.forEach((row) => {
    if (row.rowMeta.selected) {
      row.rowMeta.selected = false
    }
  })

  vSelectedAllRecords.value = false
}

watch(vSelectedAllRecords, (val) => {
  const dataCache = getDataCache()
  dataCache.cachedRows.value.forEach((row) => {
    row.rowMeta.selected = !!val
  })
})

const COLUMN_BUFFER_SIZE = 5

const calculateSlices = () => {
  if (!containerRef.value?.clientWidth || !containerRef.value?.clientHeight) {
    setTimeout(calculateSlices, 50)
    return
  }

  const startColIndex = Math.max(0, findColumnIndex(scrollLeft.value))
  const endColIndex = Math.min(
    columnWidths.value.length,
    findColumnIndex(scrollLeft.value + containerRef.value.clientWidth + COLUMN_BUFFER_SIZE) + 1,
  )

  if (startColIndex !== colSlice.value.start || endColIndex !== colSlice.value.end) {
    colSlice.value = { start: startColIndex, end: endColIndex }
  }

  if (!isGroupBy.value) {
    const dataCache = getDataCache()
    const startRowIndex = Math.max(0, Math.floor(scrollTop.value / rowHeight.value))
    const visibleRowCount = Math.ceil(containerRef.value.clientHeight / rowHeight.value)
    const endRowIndex = Math.min(startRowIndex + visibleRowCount, dataCache.totalRows.value)
    const newEndRow = Math.min(dataCache.totalRows.value, endRowIndex)
    if (startRowIndex !== rowSlice.value.start || newEndRow !== rowSlice.value.end) {
      rowSlice.value = { start: startRowIndex, end: newEndRow }
    }

    updateVisibleRows()
  }
}

function clearSelection() {
  activeCell.value.row = -1
  activeCell.value.column = -1
  selection.value.clear()
  editEnabled.value = null
}

async function onGroupRowChange({ row, level }) {
  const parentGroupPath = row.rowMeta?.path?.slice(0, level)

  const parentGroup = parentGroupPath?.length ? findGroupByPath(cachedGroups.value, parentGroupPath) : undefined

  const groupMap = parentGroup?.groups ?? cachedGroups.value

  // get the highest index value present in cachedGroups
  const endIndex = Math.max(...groupMap.keys())

  // clear selection to avoid rendering wrong cell content
  setTimeout(() => {
    clearSelection()
  }, 150)

  // reload all groups in current level since any one of them can be in updated state
  await fetchMissingGroupChunks(0, endIndex, parentGroup ?? undefined, true)

  // iterate and clear if expanded grid present
  const clearGridCache = (groupMap: Map<number, CanvasGroup>, toalGroupCount: number, path = []) => {
    for (let i = 0; i < toalGroupCount; i++) {
      const group = groupMap.get(i)
      if (group?.groupCount) {
        // if group is not expanded, check if it has subgroups and clear their cache
        clearGridCache(group.groups, group.groupCount, group.path ?? [...path, i])
      } else {
        clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, [...path, i])
      }
    }
  }

  clearGridCache(groupMap, parentGroup?.groupCount ?? totalGroups.value, parentGroup ? generateGroupPath(parentGroup) : [])

  await syncGroupCount(parentGroup)

  setTimeout(() => {
    // if scrolltop is beyond totaheight, reset it to maximum possible value
    scroller.value?.scrollTo({ top: Math.max(0, Math.min(totalHeight.value, scrollTop.value)) })
  }, 150)
}

function onActiveCellChanged() {
  if (isGroupBy.value) {
    function processGroups(groups: Map<number, CanvasGroup>) {
      for (const [, group] of groups) {
        if (group?.isExpanded) {
          if (group?.path) {
            const { isRowSortRequiredRows } = getDataCache(group.path)
            clearInvalidRows?.(group.path, {
              onGroupRowChange,
            })
            if (isRowSortRequiredRows.value.length) {
              applySorting?.(isRowSortRequiredRows.value, group.path)
            }
          } else if (group.groups) {
            processGroups(group.groups)
          }
        }
      }
    }
    processGroups(cachedGroups.value)
  } else {
    clearInvalidRows?.([])
    if (rowSortRequiredRows.value.length) {
      applySorting?.(rowSortRequiredRows.value, [])
    }
  }
  calculateSlices()
  requestAnimationFrame(triggerRefreshCanvas)
}

const onNewRecordToGridClick = (path: Array<number> = []) => {
  if (showRecordPlanLimitExceededModal()) return

  setAddNewRecordGridMode(true)

  let overwrite = {}

  if (isGroupBy.value) {
    const group = findGroupByPath(cachedGroups.value, path)
    overwrite = getDefaultGroupData(group)
  }

  addEmptyRow(undefined, undefined, undefined, overwrite, path)
  openAddNewRowDropdown.value = null
  isDropdownVisible.value = false
}

function onNewRecordToFormClick(path: Array<number> = []) {
  if (showRecordPlanLimitExceededModal()) return

  setAddNewRecordGridMode(false)
  let overwrite = {}

  if (isGroupBy.value) {
    const group = findGroupByPath(cachedGroups.value, path)
    overwrite = getDefaultGroupData(group)
  }
  openNewRecordFormHook.trigger({ overwrite, path })
  openAddNewRowDropdown.value = null
  isDropdownVisible.value = false
}

const onVisibilityChange = (value) => {
  if (value) {
    isDropdownVisible.value = true
  } else if (isCreateOrEditColumnDropdownOpen.value) {
    const keepOpen = columnEditOrAddProviderRef.value?.shouldKeepModalOpen()
    isDropdownVisible.value = keepOpen
    isCreateOrEditColumnDropdownOpen.value = keepOpen
    if (!keepOpen) {
      editColumn.value = null
      columnOrder.value = null
    }
  }
}

function closeAddColumnDropdownMenu(scrollToLastCol = false, savedColumn?: ColumnType) {
  isCreateOrEditColumnDropdownOpen.value = false
  isDropdownVisible.value = false
  editColumn.value = null

  if (savedColumn?.id) {
    setTimeout(() => {
      let width = 0
      let isColPresent = false

      for (const col of columns.value) {
        if (col.id === savedColumn?.id) {
          isColPresent = true
          break
        }

        if (!col?.fixed) {
          width += parseCellWidth(col.width)
        }
      }

      if (!isColPresent) return
      scroller.value?.scrollTo({ left: width, top: 0 })
    }, 200)
  } else if (scrollToLastCol) {
    setTimeout(() => {
      scroller.value?.scrollTo({ left: totalWidth.value })
    }, 200)
  }
}

function extractHoverMetaColRegions(row: Row, group?: CanvasGroup) {
  const isAtMaxSelection = selectedRows.value.length >= MAX_SELECTED_ROWS
  const isCheckboxDisabled = (!row.rowMeta.selected && isAtMaxSelection) || vSelectedAllRecords.value || readOnly.value
  const isChecked = row.rowMeta?.selected || vSelectedAllRecords.value

  const path = group ? generateGroupPath(group) : []

  const isHover = hoverRow.value?.rowIndex === row.rowMeta.rowIndex && (hoverRow.value?.path ?? []).join() === path.join()
  const isRowCellSelected = activeCell.value.row === row.rowMeta.rowIndex && activeCell.value.path?.join() === path.join()

  const regions = []
  let currentX = 4

  if (groupByColumns.value) {
    currentX += groupByColumns.value?.length * 13
  }

  const initialX = currentX

  if (readOnly.value || !(isHover || isChecked || isRowCellSelected)) {
    regions.push({
      x: currentX,
      width: ROW_META_COLUMN_WIDTH / 2 - 8,
      action: 'none',
    })

    currentX += ROW_META_COLUMN_WIDTH / 2 - 8 + 16
  } else if ((isHover || isChecked || isRowCellSelected) && isRowDraggingEnabled.value) {
    regions.push({
      x: currentX,
      width: 26,
      action: !selectedRows.value.length ? 'reorder' : 'none',
    })
    currentX += 26
  } else {
    // add 6px padding to the left of the row meta column if the row number is not rendered
    currentX += 6
  }

  if (!readOnly.value && (isChecked || isHover || isRowCellSelected) && !isPublicView.value) {
    regions.push({
      x: currentX,
      width: 20,
      action: isCheckboxDisabled ? 'none' : 'select',
    })
    currentX += 24
  }

  // Comment/maximize icon region

  if (row.rowMeta?.commentCount) {
    const reduceFontSize = row.rowMeta.commentCount > 99
    const commentCount = reduceFontSize ? '99+' : row.rowMeta.commentCount.toString()

    const ctx = defaultOffscreen2DContext

    const { width: commentCountWidth } = renderSingleLineText(ctx, {
      x: initialX + ROW_META_COLUMN_WIDTH / 2 - 4,
      y: 0,
      render: false,
      text: commentCount,
      maxWidth: ROW_META_COLUMN_WIDTH / 2,
      fontFamily: `600 ${reduceFontSize ? '10px' : '12px'} Inter`,
      textAlign: 'center',
      isTagLabel: true,
      fillStyle: '#3366FF',
    })

    regions.push({
      x: initialX + ROW_META_COLUMN_WIDTH - 4 - Math.max(20, commentCountWidth + 8),
      width: Math.max(20, commentCountWidth + 8),
      action: 'comment',
    })
  } else {
    regions.push({
      x: initialX + ROW_META_COLUMN_WIDTH - 4 - 20,
      width: 20,
      action: 'comment',
    })
  }

  return { isAtMaxSelection, isCheckboxDisabled, regions, currentX }
}

const handleRowMetaClick = ({
  e,
  row,
  x,
  onlyDrag,
  group,
}: {
  e: MouseEvent
  row: Row
  x: number
  onlyDrag?: boolean
  group?: CanvasGroup
}) => {
  const { isAtMaxSelection, isCheckboxDisabled, regions } = extractHoverMetaColRegions(row, group)

  const clickedRegion = regions.find((region) => x >= region.x && x < region.x + region.width)

  if (!clickedRegion) return

  if (onlyDrag && clickedRegion.action !== 'reorder' && clickedRegion.action !== 'select') return

  switch (clickedRegion.action) {
    case 'select':
      if (!isCheckboxDisabled && (row.rowMeta?.selected || !isAtMaxSelection)) {
        resetActiveCell()

        if (onlyDrag) {
          row.rowMeta.selected = !row.rowMeta?.selected

          const path = generateGroupPath(group)
          if (row.rowMeta?.selected && ncIsNumber(row.rowMeta.rowIndex)) {
            selectedRowInfo = {
              index: row.rowMeta.rowIndex,
              path,
            }
          }

          const dataCache = getDataCache(path)
          dataCache?.cachedRows.value.set(row?.rowMeta.rowIndex, row)
        }
      }
      break

    case 'reorder':
      if (e.detail === 1 && isRowReOrderEnabled.value) {
        onMouseDownRowReorderStart(e)
      }
      break

    case 'comment':
      isExpandedFormCommentMode.value = !!row.rowMeta?.commentCount
      expandForm(row, undefined, false, group?.path)
      break
  }

  requestAnimationFrame(triggerRefreshCanvas)
}

const handleUnlockView = () => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgLockView'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

// check exact row meta region hovered and return the cursor type
const getRowMetaCursor = ({ row, x, group }: { row: Row; x: number; group?: CanvasGroup }): CSSProperties['cursor'] => {
  const { regions } = extractHoverMetaColRegions(row, group)

  const clickedRegion = regions.find((region) => x >= region.x && x < region.x + region.width)

  if (!clickedRegion) return
  switch (clickedRegion.action) {
    case 'select':
      return 'pointer'
    case 'reorder':
      if (isRowReOrderEnabled.value) {
        return isRowReorderActive.value ? 'grabbing' : 'grab'
      }
      break
    case 'comment':
      return 'pointer'
  }
}

let prevActiveCell = null
let prevMenuState: {
  isCreateOrEditColumnDropdownOpen?: boolean
  openColumnDropdownField?: unknown
  editEnabled?: boolean | null
  openAggregationFieldId?: string
  openAddNewRowDropdown?: Array<number> | null
  isDropdownVisible?: boolean
  editColumn?: unknown
  columnOrder?: unknown
} = {}

let mouseUpListener = null
async function handleMouseDown(e: MouseEvent) {
  const _elementMap = new CanvasElement(elementMap.elements)
  mouseUpListener = (e) => handleMouseUp(e, _elementMap)
  document.addEventListener('mouseup', mouseUpListener)

  // keep it for later use inside mouseup event for showing/hiding dropdown based on the previous state
  prevMenuState = {
    isCreateOrEditColumnDropdownOpen: isCreateOrEditColumnDropdownOpen.value,
    openColumnDropdownField: openColumnDropdownField.value,
    editEnabled: editEnabled.value,
    // storing id since the value get alteredand it's reactive
    openAggregationFieldId: openAggregationField.value?.id,
    openAddNewRowDropdown: openAddNewRowDropdown.value,
    isDropdownVisible: isDropdownVisible.value,
    editColumn: editColumn.value,
    columnOrder: columnOrder.value,
  }

  editEnabled.value = null
  openAggregationField.value = null
  openAddNewRowDropdown.value = null
  openColumnDropdownField.value = null
  isDropdownVisible.value = false
  editColumn.value = null
  columnOrder.value = null
  isCreateOrEditColumnDropdownOpen.value = false
  overlayStyle.value = null
  contextMenuTarget.value = null
  prevActiveCell = null

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const y = e.clientY - rect.top
  const x = e.clientX - rect.left

  const clickType = getMouseClickType(e)
  if (!clickType) return
  // Handle all Column Header Operations
  if (y <= COLUMN_HEADER_HEIGHT_IN_PX) {
    // If x less than 80px, use is hovering over the row meta column
    if (x > ROW_META_COLUMN_WIDTH) {
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
    } else {
      if (isContextMenuAllowed.value && vSelectedAllRecords.value) {
        // Set the context Menu Targer and return
        contextMenuTarget.value = { row: 0, col: -1, path: [] }
        requestAnimationFrame(triggerRefreshCanvas)
      }
      return
    }
    // DO NOT TRIGGER ANY OTHER MOUSE_DOWN ACTION IF USER IS CLICKING ON COLUMN HEADER
    return
  }

  // DO NOT TRIGGER MOUSE_DOWN ACTION IF USER IS CLICKING ON AGGREGATION DROPDOWN
  if (y > height.value - 36) {
    return
  }

  const element = _elementMap.findElementAt(mousePosition.x, mousePosition.y, [
    ElementTypes.ADD_NEW_ROW,
    ElementTypes.ROW,
    ElementTypes.GROUP,
  ])
  const group = element?.group
  const row = element?.row
  const rowIndex = element?.rowIndex
  const groupPath = group ? generateGroupPath(group) : []

  if (!row) return
  // onMouseDown event, we only handle the fillHandler and selectionHandler
  // and rowReorder. Other events should be handled in onMouseUp
  if (x < ROW_META_COLUMN_WIDTH + groupByColumns.value.length * 13) {
    if (clickType !== MouseClickType.SINGLE_CLICK) return
    handleRowMetaClick({ e, row, x, onlyDrag: true, group })
    return
  }

  // Check if the user is clicking on a fillHandler
  // If user clicked on fillHandler, we set the isFillHandlerActive to true
  // So we can handle the fillHandler operations
  onMouseDownFillHandlerStart(e)
  if (isFillHandlerActive.value) return

  const { column: clickedColumn } = findClickedColumn(x, scrollLeft.value)

  if (!clickedColumn?.columnObj) {
    selection.value.clear()
    activeCell.value = { row: -1, column: -1, path: [] }
    editEnabled.value = null
  }

  // If the new cell user clicked is not the active cell
  // call onActiveCellChanged to clear invalid rows and reorder records locally if required
  if (
    rowIndex !== activeCell.value?.row ||
    !comparePath(
      groupPath.map((v) => `${v}`),
      activeCell.value?.path,
    )
  ) {
    onActiveCellChanged()
    resetRowSelection()
  }

  // If the user is trying to open the context menu
  if (clickType === MouseClickType.RIGHT_CLICK && clickedColumn?.id) {
    // If the selection is not empty and user right clicks on a selection, do not update activeCell
    if (selection.value.isEmpty()) {
      activeCell.value.row = rowIndex
      activeCell.value.column = columns.value.findIndex((col) => col.id === clickedColumn.id)
      activeCell.value.path = groupPath
    }
    const columnIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)
    const isWithinSelection = selection.value.isCellInRange({ row: rowIndex, col: columnIndex })
    // If right-clicked cell is not within the selection, clear the selection and set the new cell as the selection
    if (!isWithinSelection) {
      selection.value.clear()
      selection.value.startRange({ row: rowIndex, col: columnIndex })
      selection.value.endRange({ row: rowIndex, col: columnIndex })
    }

    if (isContextMenuAllowed.value) {
      // Set the context Menu Target and return
      contextMenuTarget.value = { row: rowIndex, col: columnIndex, path: groupPath }
      requestAnimationFrame(triggerRefreshCanvas)
    }
    return
  }

  if (clickType !== MouseClickType.DOUBLE_CLICK) {
    prevActiveCell = activeCell.value
    // If the cell is not double-clicked, continue to onMouseDownSelectionHandler
    onMouseDownSelectionHandler(e)
  }

  requestAnimationFrame(triggerRefreshCanvas)
}

const PADDING_BOTTOM = 96
const FIXED_COLUMN_PADDING = 128

function scrollToCell(row?: number, column?: number, path?: Array<number>, horizontalScroll: boolean = true): void {
  const currentRow = row ?? activeCell.value.row ?? -1
  const currentColumn = column ?? activeCell.value.column ?? -1
  const currentPath = path ?? activeCell.value.path ?? []

  let cellTop = 0
  let cellBottom = 0

  if (isGroupBy.value && cachedGroups.value) {
    cellTop = calculateGroupRowTop(cachedGroups.value, currentPath, currentRow, rowHeight.value, isAddingEmptyRowAllowed.value)
    cellBottom = cellTop + rowHeight.value + PADDING_BOTTOM
  } else {
    cellTop = currentRow * rowHeight.value
    cellBottom = cellTop + rowHeight.value + PADDING_BOTTOM
  }

  const scrollTop = scroller.value?.getScrollPosition().top ?? 0
  const viewportHeight = height.value

  if (cellTop < scrollTop) {
    scroller.value?.scrollTo({
      top: cellTop,
    })
  } else if (cellBottom > scrollTop + viewportHeight) {
    scroller.value?.scrollTo({
      top: cellBottom - viewportHeight,
    })
  }

  if (!horizontalScroll) return

  const fixedWidth =
    columns.value
      .filter((col) => col.fixed)
      .reduce((sum: number, col) => {
        return sum + parseCellWidth(col.width)
      }, 0) + FIXED_COLUMN_PADDING

  let cellLeft = 0

  for (let i = 0; i < currentColumn; i++) {
    const column = columns.value[i]
    if (!column) continue

    if (!column.fixed) {
      cellLeft += parseCellWidth(column.width)
    }
  }

  const currentColumnWidth = columns.value[currentColumn]?.width
  const parsedWidth = parseCellWidth(currentColumnWidth)
  let cellRight = cellLeft + parsedWidth

  cellLeft += fixedWidth
  cellRight += fixedWidth

  const scrollLeft = scroller.value?.getScrollPosition().left ?? 0
  const viewportWidth = width.value

  if (cellLeft < scrollLeft + fixedWidth) {
    scroller.value?.scrollTo({
      left: cellLeft - fixedWidth,
    })
  } else if (cellRight > scrollLeft + viewportWidth) {
    scroller.value?.scrollTo({
      left: cellRight - viewportWidth,
    })
  }
}

async function handleMouseUp(e: MouseEvent, _elementMap: CanvasElement) {
  e.preventDefault()
  if (mouseUpListener) {
    document.removeEventListener('mouseup', mouseUpListener)
    mouseUpListener = null
    selectedRowInfo = { index: null, path: [] }
  }

  await onMouseUpFillHandlerEnd()
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const y = e.clientY - rect.top
  const x = e.clientX - rect.left

  if (editEnabled.value) return

  if (onMouseUpSelectionHandler(e)) {
    if (y <= COLUMN_HEADER_HEIGHT_IN_PX || y > height.value - 36 || x <= ROW_META_COLUMN_WIDTH) {
      // DO_NOTHING_HERE
    } else {
      requestAnimationFrame(triggerRefreshCanvas)
      return
    }
  }
  if (isRowReorderActive.value) return

  const clickType = getMouseClickType(e)
  if (!clickType) return

  if (isMobileMode.value) {
    if (y > 32 && y < height.value - 36) {
      const element = _elementMap.findElementAt(x, y, [ElementTypes.ROW, ElementTypes.GROUP, ElementTypes.ADD_NEW_ROW])
      const group = element?.group
      const row = element?.row
      const rowIndex = row?.rowMeta?.rowIndex ?? -1

      if (element?.isGroup) {
        toggleExpand(group)
      } else if (element?.isRow && row) {
        if (removeInlineAddRecord.value && rowIndex >= EXTERNAL_SOURCE_VISIBLE_ROWS) return

        expandForm(row, undefined, false, group?.path)
      }
      requestAnimationFrame(triggerRefreshCanvas)
      return
    } else if (y < 32) {
      return
    }
  }
  // Handle all Column Header Operations
  if (y <= COLUMN_HEADER_HEIGHT_IN_PX) {
    // If x less than 80px, use is hovering over the row meta column
    if (x < ROW_META_COLUMN_WIDTH + groupByColumns.value.length * 13) {
      // If the click is not normal single click, return
      if (clickType !== MouseClickType.SINGLE_CLICK || readOnly.value || isGroupBy.value) return
      if (isBoxHovered({ x: isRowDraggingEnabled.value ? 4 + 26 : 10, y: 8, height: 16, width: 16 }, mousePosition)) {
        vSelectedAllRecords.value = !vSelectedAllRecords.value
        resetActiveCell()
      }

      requestAnimationFrame(triggerRefreshCanvas)
      return
    } else {
      // If x more than 80px, check if the user is trying to add a new column
      const plusColumnX = totalColumnsWidth.value - scrollLeft.value + groupByColumns.value.length * 13
      const plusColumnWidth = ADD_NEW_COLUMN_WIDTH
      // If the user is trying to add a new column
      if (x >= plusColumnX && x <= plusColumnX + plusColumnWidth) {
        if (!isAddingColumnAllowed.value) return

        // if menu already in open state then close it on second click
        if (prevMenuState.isCreateOrEditColumnDropdownOpen && !prevMenuState.editColumn) {
          return
        }

        isCreateOrEditColumnDropdownOpen.value = true
        overlayStyle.value = {
          top: `${rect.top}px`,
          left: `${plusColumnX + rect.left}px`,
          width: `${plusColumnWidth}px`,
          height: '32px',
          position: 'fixed',
        }
        isDropdownVisible.value = true
        requestAnimationFrame(triggerRefreshCanvas)
        return
      }

      // If user is clicking on an existing column
      const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)
      const isFieldNotEditable = !isUIAllowed('fieldEdit')

      if (clickedColumn) {
        if (clickType === MouseClickType.RIGHT_CLICK) {
          if (isFieldNotEditable) return

          // IF Right-click on a column, open the column dropdown menu
          openColumnDropdownField.value = clickedColumn.columnObj
          lastOpenColumnDropdownField.value = clickedColumn.columnObj
          isDropdownVisible.value = true
          overlayStyle.value = {
            top: `${rect.top}px`,
            left: `${rect.left + xOffset}px`,
            width: `${clickedColumn.width}`,
            height: `32px`,
            position: 'fixed',
          }
          requestAnimationFrame(triggerRefreshCanvas)
          return
        } else {
          const columnWidth = parseCellWidth(clickedColumn.width)
          const iconOffsetX = xOffset + columnWidth - 24
          // check if clicked on the column menu icon
          if (y <= 21 && y >= 9 && iconOffsetX <= x && iconOffsetX + 14 >= x) {
            if (isFieldNotEditable) return

            // if menu already in open state then close it on second click
            if (prevMenuState.isDropdownVisible && prevMenuState.openColumnDropdownField === clickedColumn.columnObj) {
              return
            }

            overlayStyle.value = {
              top: `${rect.top}px`,
              left: `${rect.left + xOffset}px`,
              width: `${clickedColumn.width}`,
              height: `32px`,
              position: 'fixed',
            }
            openColumnDropdownField.value = clickedColumn.columnObj
            lastOpenColumnDropdownField.value = clickedColumn.columnObj
            isDropdownVisible.value = true
            requestAnimationFrame(triggerRefreshCanvas)
            return
          }
          // If the user clicked on a column, check if the user is trying to edit the column
          // On Double-click, should open the column edit dialog
          // kept under else to avoid opening the column edit dialog on doubleclicking the column menu icon
          else if (clickType === MouseClickType.DOUBLE_CLICK) {
            // If active cursor is col-resize, we don't want an accidental double click to
            // open the edit column modal as the intention is to resize the column
            if (activeCursor.value === 'col-resize') return

            handleEditColumn(e, false, clickedColumn.columnObj, xOffset)

            selection.value.startRange({ row: NaN, col: NaN })
            selection.value.endRange({ row: NaN, col: NaN })

            activeCell.value = { row: -1, column: -1, path: activeCell.value?.path ?? [] }

            requestAnimationFrame(triggerRefreshCanvas)
            return
          } else if (!isGroupBy.value && x < xOffset + columnWidth - 20 - (clickedColumn.columnObj?.description ? 24 : 0)) {
            const colIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)

            const dataCache = getDataCache()

            // Calculate the 0-based index of the last row to select.
            // This is the minimum of the total number of rows - 1 (for 0-based index) or 99 (limiting to 100 rows).
            const endRowIndex = Math.min(dataCache.totalRows.value - 1, 99)
            selection.value.startRange({ row: 0, col: colIndex })
            selection.value.endRange({ row: endRowIndex, col: colIndex })

            resetRowSelection()

            activeCell.value = { row: 0, column: colIndex, path: [] }
            onActiveCellChanged()
            requestAnimationFrame(triggerRefreshCanvas)
          }
        }
      }
      requestAnimationFrame(triggerRefreshCanvas)
      return
    }
  }

  // If the user is clicking on the Aggregation in bottom
  if (y > height.value - 36) {
    if (isLocked.value && isUIAllowed('fieldAdd')) {
      handleUnlockView()
      return
    }
    // If the click is not normal single click, return
    const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)

    if (clickedColumn) {
      // if clicked on same aggregation field, close the dropdown
      if (
        prevMenuState.isDropdownVisible &&
        prevMenuState.openAggregationFieldId &&
        prevMenuState.openAggregationFieldId === clickedColumn.id
      ) {
        return
      }

      openAggregationField.value = clickedColumn
      isDropdownVisible.value = true
      overlayStyle.value = {
        top: `${rect.top + height.value - 36}px`,
        left: `${rect.left + xOffset}px`,
        width: clickedColumn.width,
        height: `36px`,
        position: 'fixed',
      }
    }
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  const element = _elementMap.findElementAt(x, y, [ElementTypes.ADD_NEW_ROW, ElementTypes.ROW, ElementTypes.GROUP])
  let group = element?.group
  const row = element?.row
  const rowIndex = row?.rowMeta?.rowIndex ?? -1
  const groupPath = group ? generateGroupPath(group) : []
  const isAddNewRow = element?.type === ElementTypes.ADD_NEW_ROW

  if (!group && element?.groupPath) {
    group = cachedGroups.value.get(groupPath[0])
  }

  const dataCache = getDataCache(groupPath)

  if (element?.isGroup) {
    if (clickType === MouseClickType.SINGLE_CLICK) {
      const { column: clickedColumn, xOffset } = findClickedColumn(x, scrollLeft.value)

      if ((clickedColumn && clickedColumn?.fixed) || !appInfo.value.ee) {
        toggleExpand(group)
      } else if (clickedColumn) {
        // if clicked on same aggregation field, close the dropdown
        if (
          prevMenuState.isDropdownVisible &&
          prevMenuState.openAggregationFieldId &&
          prevMenuState.openAggregationFieldId === clickedColumn.id
        ) {
          return
        }
        openAggregationField.value = clickedColumn
        isDropdownVisible.value = true
        overlayStyle.value = {
          top: `${rect.top + y - 36}px`,
          left: `${rect.left + xOffset}px`,
          width: clickedColumn.width,
          height: `36px`,
          position: 'fixed',
        }
      }
    }
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  if (removeInlineAddRecord.value) {
    if (rowIndex >= EXTERNAL_SOURCE_VISIBLE_ROWS) {
      return
    } else {
      if (upgradeModalInlineState.value.isHoveredLearnMore) {
        window.open('https://nocodb.com/pricing', '_blank', 'noopener,noreferrer')
        return
      }

      if (upgradeModalInlineState.value.isHoveredUpgrade) {
        return navigateToPricing({ limitOrFeature: PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE })
      }
    }
  }

  if (isAddNewRow && clickType === MouseClickType.SINGLE_CLICK && x < totalColumnsWidth.value - scrollLeft.value) {
    if (isAddingEmptyRowAllowed.value) {
      if (isGroupBy.value) {
        const elem = _elementMap.findElementAtWithX(x, y, ElementTypes.EDIT_NEW_ROW_METHOD)

        if (elem) {
          if (comparePath(prevMenuState.openAddNewRowDropdown, groupPath)) {
            isDropdownVisible.value = true
            openAddNewRowDropdown.value = []
            requestAnimationFrame(triggerRefreshCanvas)
            return
          }

          openAddNewRowDropdown.value = groupPath
          isDropdownVisible.value = true
          overlayStyle.value = {
            top: `${rect.top + elem.y - 120}px`,
            left: `${rect.left + x + 140}px`,
            width: elem.width,
            height: `36px`,
            position: 'fixed',
          }
          requestAnimationFrame(triggerRefreshCanvas)
          return
        }

        const setGroup = getDefaultGroupData(group)

        if (isAddNewRecordGridMode.value || !isGroupBy.value) {
          addEmptyRow(undefined, undefined, undefined, setGroup, groupPath)
        } else {
          openNewRecordHandler({ overwrite: setGroup, path: groupPath })
        }
      } else {
        if (removeInlineAddRecord.value) return

        await addEmptyRow()
      }
    }
    selection.value.clear()
    activeCell.value.row = rowIndex
    activeCell.value.column = 1
    activeCell.value.path = groupPath
    requestAnimationFrame(triggerRefreshCanvas)
    return
  } else if (rowIndex > dataCache.totalRows.value && !isGroupBy.value) {
    selection.value.clear()
    activeCell.value = { row: -1, column: -1, path: [] }
    onActiveCellChanged()
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  if (x < ROW_META_COLUMN_WIDTH + groupByColumns.value.length * 13) {
    if (!row) return
    if (![MouseClickType.SINGLE_CLICK, MouseClickType.RIGHT_CLICK].includes(clickType)) return

    switch (clickType) {
      case MouseClickType.SINGLE_CLICK:
        handleRowMetaClick({ e, row, x, group: element?.group })
        break
      case MouseClickType.RIGHT_CLICK:
        if (isContextMenuAllowed.value) {
          contextMenuTarget.value = { row: rowIndex, col: -1, path: groupPath }
          requestAnimationFrame(triggerRefreshCanvas)
        }
        break
    }
    return
  }

  // last active cell state before clearing current state
  const lastActiveCell = { ...activeCell.value }

  // Normal cell click operation
  // We set the activeCell to -1, -1 to clear the active cell
  if (rowIndex < rowSlice.value.start || rowIndex >= rowSlice.value.end) {
    activeCell.value.row = -1
    activeCell.value.column = -1
    activeCell.value.path = []
    requestAnimationFrame(triggerRefreshCanvas)
  }

  const { column: clickedColumn } = findClickedColumn(x, scrollLeft.value)

  if (!clickedColumn) {
    // If the user is not clicked in a column, clear the active cell and selection
    // Return
    activeCell.value.row = -1
    activeCell.value.column = -1
    activeCell.value.path = []
    selection.value.clear()
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }
  // If the user is not clicking on a row
  if (!row) {
    // if an active cell state is getting reset, trigger onActiveCellChanged
    if (lastActiveCell.row !== -1 && lastActiveCell.column !== -1 && rowIndex === -1) {
      onActiveCellChanged()
    }

    return
  }
  const pk = extractPkFromRow(row?.row, meta.value?.columns as ColumnType[])
  const colIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)

  if (clickType === MouseClickType.RIGHT_CLICK) {
    activeCell.value.row = rowIndex
    activeCell.value.column = colIndex
    activeCell.value.path = groupPath
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }

  // handle the cellClick to corresponding cell.
  // If it performed an action, will return true
  const res = await handleCellClick({
    event: e,
    row: row!,
    column: clickedColumn,
    value: row?.row[clickedColumn.title],
    mousePosition: { x, y },
    pk,
    selected:
      prevActiveCell?.row === rowIndex && prevActiveCell?.column === colIndex && comparePath(prevActiveCell?.path, groupPath),
    imageLoader,
    path: groupPath,
    baseRoleLoader,
  })
  // Set the active cell to the clicked cell
  activeCell.value.row = rowIndex
  activeCell.value.column = colIndex
  activeCell.value.path = groupPath
  if (res) {
    // If the cellClick performed an action, return
    // Set the cell as selected
    selection.value.startRange({ row: rowIndex, col: colIndex })
    selection.value.endRange({ row: rowIndex, col: colIndex })
    requestAnimationFrame(triggerRefreshCanvas)
    return
  }
  if (!clickedColumn?.fixed) {
    scrollToCell()
  }
  requestAnimationFrame(triggerRefreshCanvas)
  const columnUIType = clickedColumn.columnObj.uidt as UITypes

  // If the cell is editable, make the cell editable
  // Virtual Cells BARCODE, QRCode, Lookup, we need to render the actual cell if double clicked
  if (clickType === MouseClickType.DOUBLE_CLICK) {
    if (NO_EDITABLE_CELL.includes(columnUIType)) return

    const supportedVirtualColumns = [UITypes.Barcode, UITypes.QrCode, UITypes.Lookup]
    if (!supportedVirtualColumns.includes(columnUIType) && clickedColumn?.virtual) return
    makeCellEditable(row, clickedColumn)
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
  type: 'columnIcon' | 'title' | 'error' | 'info' | 'columnChevron'
  text: string
  disableTooltip?: boolean
}[] => {
  const regions: {
    x: number
    width: number
    type: 'columnIcon' | 'title' | 'error' | 'info' | 'columnChevron'
    text: string
    height?: number
    y?: number
    disableTooltip?: boolean
  }[] = []
  let xOffset = initialOffset + 1

  const ctx = defaultOffscreen2DContext
  ctx.save()
  ctx.font = '550 12px Inter'
  columns.value.slice(startColIndex, endColIndex).forEach((column) => {
    const width = parseCellWidth(column.width)

    const isRowNumber = column.id === 'row_number'

    if (isRowNumber && isGroupBy.value) {
      xOffset += width
      return
    }

    const rightPadding = 8
    let totalIconWidth = rightPadding + 16

    if (column.uidt) {
      totalIconWidth += 26
      regions.push({
        x: xOffset + 8 - scrollLeftValue,
        width: 13,
        type: 'columnIcon',
        text: columnTypeName(column),
      })
    }

    if (column.isInvalidColumn?.isInvalid && !column.isInvalidColumn?.ignoreTooltip) {
      totalIconWidth += 18
    }

    if (column?.columnObj?.description?.length) {
      totalIconWidth += 18
    }

    const availableTextWidth = width - totalIconWidth
    const measuredTextWidth = ctx.measureText(column.title!).width
    const isTruncated = measuredTextWidth > availableTextWidth

    regions.push({
      x: xOffset + (column.uidt ? 26 : isRowDraggingEnabled.value ? 26 + 4 : 10) - scrollLeftValue,
      // 16px is for checkbox and it's not renders on load
      width: Math.max(column.uidt ? 0 : 16, isTruncated ? availableTextWidth : measuredTextWidth),
      type: 'title',
      text: column.title!,
      disableTooltip: !isTruncated,
    })

    let rightOffset = xOffset + width - rightPadding - (isFieldEditAllowed.value ? 16 : 0)

    if (isRowNumber) {
      xOffset += width
      return
    }

    if (isFieldEditAllowed.value && !column.columnObj?.readonly) {
      regions.push({
        x: rightOffset - scrollLeftValue,
        width: 14,
        type: 'columnChevron',
        disableTooltip: true,
        text: null,
      })
    } else if (meta.value?.synced && column.columnObj?.readonly) {
      regions.push({
        x: rightOffset - scrollLeftValue,
        width: 14,
        type: 'synced',
        disableTooltip: false,
        text: 'This field is synced',
      })
    }

    // Error icon region
    if (column.isInvalidColumn?.isInvalid && !column.isInvalidColumn?.ignoreTooltip) {
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
  ctx.restore()
  regions.forEach((region) => {
    region.y = 8
    region.height = region.width
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

  let cursor = colResizeHoveredColIds.value.size ? 'col-resize' : 'auto'
  hideTooltip()

  if (mousePosition.y < 32) {
    const fixedCols = columns.value.filter((col) => col.fixed)

    // check if it's hovering add new column
    const plusColumnX = totalColumnsWidth.value - scrollLeft.value + groupByColumns.value?.length * 13
    const plusColumnWidth = ADD_NEW_COLUMN_WIDTH

    if (mousePosition.x >= plusColumnX && mousePosition.x <= plusColumnX + plusColumnWidth && isFieldEditAllowed.value) {
      cursor = 'pointer'
    }

    // We handle the tooltip & pointer related items for fixed columns first
    // If the mouse is hovering over the fixed columns, we show the tooltip
    if (fixedCols.length) {
      const fixedRegions = getHeaderTooltipRegions(0, fixedCols.length, 0, 0)
      const activeFixedRegion = fixedRegions.find(
        (region) => mousePosition.x >= region.x && mousePosition.x <= region.x + region.width,
      )

      if (['title', 'columnChevron'].includes(activeFixedRegion?.type) && isFieldEditAllowed.value) {
        cursor = 'pointer'
      }
      if (activeFixedRegion && !activeFixedRegion.disableTooltip) {
        tryShowTooltip({
          rect: activeFixedRegion,
          text: activeFixedRegion.text,
          mousePosition,
        })
      }
    }

    // Now we check if the mouse is over the x positions of the fixed columns
    const isMouseOverFixedRegions = fixedCols.some((col) => {
      const width = parseCellWidth(col.width)
      return mousePosition.x >= 0 && mousePosition.x <= width
    })

    // We do not want to process the tooltip & pointer for the non-fixed columns if the mouse is over the fixed columns
    // If the mouse is not over the fixed columns, we show the tooltip for the non-fixed columns
    if (!isMouseOverFixedRegions) {
      let initialOffset = 0
      for (let i = 0; i < colSlice.value.start; i++) {
        initialOffset += parseCellWidth(columns.value[i]!.width)
      }

      const fixedWidth = fixedCols.reduce((sum, col) => sum + parseCellWidth(col.width), 0)

      if (mousePosition.x >= fixedWidth) {
        const tooltipRegions = getHeaderTooltipRegions(colSlice.value.start, colSlice.value.end, initialOffset, scrollLeft.value)
        const activeRegion = tooltipRegions.find(
          (region) => mousePosition.x >= region.x && mousePosition.x <= region.x + region.width,
        )

        if (['title', 'columnChevron'].includes(activeRegion?.type) && isFieldEditAllowed.value) {
          cursor = 'pointer'
        }

        if (activeRegion && !activeRegion.disableTooltip) {
          tryShowTooltip({
            rect: activeRegion,
            text: activeRegion.text,
            mousePosition,
          })
        }
      }
    }
  }
  if (isFillHandlerActive.value) {
    onMouseMoveFillHandlerMove(e)
  } else if (isDragging.value || resizeableColumn.value) {
    if (mousePosition.x >= width.value - 200) {
      scroller.value?.scrollTo({
        left: scrollLeft.value + 10,
      })
    } else if (mousePosition.x <= 200) {
      scroller.value?.scrollTo({
        left: scrollLeft.value - 10,
      })
    }
  } else {
    const y = e.clientY - rect.top
    if (y <= 32 && resizeableColumn.value) {
      resizeMouseMove(e)
    } else if (mousePosition.y > height.value - 36) {
      cursor = mousePosition.x < totalColumnsWidth.value - scrollLeft.value ? 'pointer' : 'auto'
      setCursor(cursor)
      requestAnimationFrame(triggerRefreshCanvas)
      return
    } else {
      const element = elementMap.findElementAt(mousePosition.x, mousePosition.y, [ElementTypes.ADD_NEW_ROW, ElementTypes.ROW])
      if (element) {
        if (
          removeInlineAddRecord.value &&
          !element?.group &&
          element?.rowIndex &&
          element?.rowIndex >= EXTERNAL_SOURCE_VISIBLE_ROWS
        )
          return

        hoverRow.value = {
          rowIndex: element?.rowIndex,
          path: generateGroupPath(element?.group),
        }
      }

      onMouseMoveSelectionHandler(e)
    }
    requestAnimationFrame(triggerRefreshCanvas)
  }
  if (mousePosition.y > 32) {
    const element = elementMap.findElementAt(mousePosition.x, mousePosition.y, [ElementTypes.ADD_NEW_ROW, ElementTypes.ROW])
    const row = element?.row
    const rowIndex = element?.rowIndex
    const groupPath = generateGroupPath(element?.group)

    const { column } = findClickedColumn(mousePosition.x, scrollLeft.value)
    if (!row || !column) {
      if (element?.type === ElementTypes.ADD_NEW_ROW && mousePosition.x < totalColumnsWidth.value - scrollLeft.value) {
        setCursor('pointer')
      } else {
        setCursor('auto')
      }
      return
    }
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
      path: groupPath,
    })
  }

  if (cursor) setCursor(cursor)

  // check if hovering row meta column and set cursor
  if (
    mousePosition.x < ROW_META_COLUMN_WIDTH + groupByColumns.value.length * 13 &&
    mousePosition.y > COLUMN_HEADER_HEIGHT_IN_PX
  ) {
    // handle hovering on the aggregation dropdown
    if (mousePosition.y <= height.value - 36) {
      const element = elementMap.findElementAt(mousePosition.x, mousePosition.y, [ElementTypes.ADD_NEW_ROW, ElementTypes.ROW])
      const row = element?.row
      cursor = getRowMetaCursor({ row, x: mousePosition.x, group: element?.group }) || cursor

      if (cursor) setCursor(cursor)

      if (
        !row ||
        ncIsUndefined(row.rowMeta.rowIndex) ||
        !ncIsNumber(selectedRowInfo.index) ||
        (isGroupBy.value ? !comparePath(selectedRowInfo.path, element.groupPath) : false)
      ) {
        return
      }

      const { isAtMaxSelection, isCheckboxDisabled, regions } = extractHoverMetaColRegions(row, element?.group)

      if (isAtMaxSelection || isCheckboxDisabled) return

      const clickedRegion = regions.find((region) => mousePosition.x >= region.x && mousePosition.x < region.x + region.width)

      if (!clickedRegion || clickedRegion.action !== 'select') return

      const selectionStart = Math.min(selectedRowInfo.index, row.rowMeta.rowIndex)

      const selectionEnd = Math.min(selectionStart + MAX_SELECTED_ROWS, Math.max(selectedRowInfo.index, row.rowMeta.rowIndex))

      const dataCache = getDataCache(element.groupPath)

      dataCache.cachedRows.value.forEach((row) => {
        if (row.rowMeta.rowIndex >= selectionStart && row.rowMeta.rowIndex <= selectionEnd) {
          row.rowMeta.selected = true
        } else {
          row.rowMeta.selected = false
        }
      })

      requestAnimationFrame(triggerRefreshCanvas)
    }
  }
}

const handleMouseLeave = () => {
  activeCursor.value = 'auto'
  hideTooltip()
}

const reloadViewDataHookHandler = withLoading(async (params) => {
  if (isGroupBy.value) {
    if (params?.path?.length) {
      clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, params?.path)
      syncCount(params?.path)
      calculateSlices()
      editEnabled.value = null
      requestAnimationFrame(triggerRefreshCanvas)
      return
    }

    await syncGroupCount()
    groupDataCache.value.clear()
    clearGroupCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
    setTimeout(() => {
      // if scrolltop is beyond totaheight, reset it to maximum possible value
      scroller.value?.scrollTo({ top: Math.max(0, Math.min(totalHeight.value, scrollTop.value)) })
    }, 150)
  } else {
    clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
    await syncCount()
    updateVisibleRows()
  }

  calculateSlices()

  requestAnimationFrame(triggerRefreshCanvas)
})

let rafId: number | null = null
let scrollTimeout: number | null = null

const handleScroll = (e: { left: number; top: number }) => {
  if (rafId) cancelAnimationFrame(rafId)
  if (scrollTimeout) clearTimeout(scrollTimeout)

  rafId = requestAnimationFrame(() => {
    scrollTop.value = Math.max(0, e.top)
    if (totalWidth.value < width.value) {
      scrollLeft.value = 0
    } else {
      scrollLeft.value = Math.max(0, e.left)
    }
    calculateSlices()
    triggerRefreshCanvas()
  })

  scrollTimeout = window.setTimeout(() => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    // TODO: @DarkPhoenix2704
    // hoverRow.value = Math.floor(scrollTop.value / rowHeight.value + (mousePosition.y - 32) / rowHeight.value)
    requestAnimationFrame(triggerRefreshCanvas)
  }, 150)
}

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

async function saveEmptyRow(rowObj: Row, before?: string, path: Array<number> = []) {
  await updateOrSaveRow?.(rowObj, null, null, { metaValue: meta.value, viewMetaValue: view.value }, before, path)
}

function addEmptyColumn(columnOrderData: Pick<ColumnReqType, 'column_order'> | null = null, renderAtCurrentPosition = false) {
  columnOrder.value = columnOrderData
  editColumn.value = null
  openColumnDropdownField.value = null
  if (!isAddingColumnAllowed.value) return
  $e('c:shortcut', { key: 'ALT + C' })

  if (renderAtCurrentPosition) {
    isDropdownVisible.value = true
    isCreateOrEditColumnDropdownOpen.value = true

    requestAnimationFrame(triggerRefreshCanvas)
  } else {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    scroller.value?.scrollTo({
      left: totalColumnsWidth.value,
    })

    overlayStyle.value = {
      top: `${rect.top}px`,
      right: `${256 - ADD_NEW_COLUMN_WIDTH}px`,
      width: `${ADD_NEW_COLUMN_WIDTH}px`,
      height: '32px',
      position: 'fixed',
    }

    isDropdownVisible.value = true
    isCreateOrEditColumnDropdownOpen.value = true

    requestAnimationFrame(triggerRefreshCanvas)
  }
}

function handleEditColumn(_e: MouseEvent, isDescription = false, column: ColumnType, clickedXOffset?: number) {
  if (
    isUIAllowed('fieldEdit') &&
    !isMobileMode.value &&
    (isDescription ? true : !isMetaReadOnly.value || readonlyMetaAllowedTypes.includes(column.uidt)) &&
    !isSqlView.value
  ) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (isDescription) {
      isEditColumnDescription.value = true
    }

    if (!column?.id) return

    const { column: col, xOffset } = findColumnPosition(column.id, scrollLeft.value)

    overlayStyle.value = {
      top: `${rect.top}px`,
      left: `${rect.left + (clickedXOffset ?? xOffset)}px`,
      width: col?.width ?? '180px',
      height: `32px`,
      position: 'fixed',
    }

    openColumnDropdownField.value = null
    editColumn.value = column
    isDropdownVisible.value = true
    isCreateOrEditColumnDropdownOpen.value = true
  }
}

function openColumnCreate(data: any) {
  scroller.value?.scrollTo({
    left: totalWidth.value,
  })
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  setTimeout(() => {
    // if menu already in open state then close it on second click
    if (prevMenuState.isCreateOrEditColumnDropdownOpen && !prevMenuState.editColumn) {
      return
    }

    const plusColumnX = totalColumnsWidth.value - scrollLeft.value
    overlayStyle.value = {
      top: `${rect.top}px`,
      left: `${plusColumnX + rect.left}px`,
      width: `${ADD_NEW_COLUMN_WIDTH}px`,
      height: '32px',
      position: 'fixed',
    }

    openColumnDropdownField.value = null
    preloadColumn.value = data
    isDropdownVisible.value = true
    isCreateOrEditColumnDropdownOpen.value = true
    requestAnimationFrame(triggerRefreshCanvas)
  }, 500)
}

async function addEmptyRow(row?: number, skipUpdate = false, before?: string, overwrite = {}, path: Array<number> = []) {
  if (showRecordPlanLimitExceededModal({ focusBtn: null })) return

  if (removeInlineAddRecord.value && !skipUpdate && !before && !row && !path.length) {
    return
  }

  const dataCache = getDataCache(path)

  clearInvalidRows?.(path, {
    onGroupRowChange,
  })
  if (dataCache?.isRowSortRequiredRows.value.length) {
    applySorting?.(dataCache?.isRowSortRequiredRows.value, path)
  }

  const rowObj = callAddEmptyRow?.(row, undefined, overwrite, path)

  if (!skipUpdate && rowObj) {
    saveEmptyRow(rowObj, before, path)
  }

  calculateSlices()
  requestAnimationFrame(triggerRefreshCanvas)

  nextTick().then(() => {
    activeCell.value = { row: row ?? dataCache.totalRows.value - 1, column: contextMenuTarget.value?.col ?? 1, path }
    selection.value.startRange({ row: row ?? dataCache.totalRows.value - 1, col: contextMenuTarget.value?.col ?? 1 })
    selection.value.endRange({ row: row ?? dataCache.totalRows.value - 1, col: contextMenuTarget.value?.col ?? 1 })
    scrollToCell()
  })

  return rowObj
}

async function openNewRecordHandler({ overwrite, path }) {
  // Add an empty row
  const newRow = await addEmptyRow(undefined, true, undefined, overwrite, path)
  // Expand the form
  if (newRow) expandForm?.(newRow, undefined, true, path)
}

const callAddNewRow = (context: { row: number; col: number; path: Array<number> }, direction: 'above' | 'below') => {
  const dataCache = getDataCache(context?.path)

  const { cachedRows } = dataCache

  const row = cachedRows.value.get(direction === 'above' ? context.row : context.row + 1)
  if (row) {
    const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
    addEmptyRow(context.row + (direction === 'above' ? 0 : 1), false, rowId!, {}, context?.path)
  } else {
    addEmptyRow(undefined, false, undefined, {}, context?.path)
  }
}

const onNavigate = async (dir: NavigateDir) => {
  if (ncIsNullOrUndefined(activeCell.value?.row) || ncIsNullOrUndefined(activeCell.value?.column)) return

  const path = editEnabled.value?.path || activeCell.value.path

  const group = findGroupByPath(cachedGroups.value, path)

  const defaultData = getDefaultGroupData(group)

  const dataCache = getDataCache(path)

  editEnabled.value = null
  selection.value.clear()

  switch (dir) {
    case NavigateDir.NEXT:
      if (activeCell.value.row < dataCache.totalRows.value - 1) {
        activeCell.value.row++
      } else {
        addEmptyRow(undefined, false, undefined, defaultData, path)
        activeCell.value.row++
      }
      break
    case NavigateDir.PREV:
      if (activeCell.value.row > 0) {
        activeCell.value.row--
      }
      break
  }
  // When editCell Unmounts, it triggers the update of the record
  // If onActiveCellCHanged is triggered simultaneously, it clear the record in cacheRows and the update happends in the next record
  // So call onActiveCellChanged in next tick. This ensured update is triggered before clearing from cached rows
  await nextTick(() => {
    onActiveCellChanged()
  })
  selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
  selection.value.endRange({ row: activeCell.value.row, col: activeCell.value.column })

  requestAnimationFrame(triggerRefreshCanvas)

  nextTick(() => {
    scrollToCell()
  })
}

const bulkUpdataContext = (path: Array<number>) => {
  emits('bulkUpdateDlg', path)
}

watch([height, width, windowWidth, windowHeight], () => {
  nextTick(() => {
    calculateSlices()
    requestAnimationFrame(triggerRefreshCanvas)
  })
})

watch(totalHeight, (newHeight) => {
  if (scrollTop.value > newHeight - height.value) {
    scroller.value?.scrollTo({
      top: Math.max(newHeight - height.value - 256, 0),
    })
  }
})

// Watch for Rowheight Changes
watch(rowHeight, () => {
  calculateSlices()
  requestAnimationFrame(triggerRefreshCanvas)
})

// watch for column hide and re-render canvas
watch([() => columns.value?.length, () => totalRows.value], () => {
  nextTick(() => {
    calculateSlices()
    requestAnimationFrame(triggerRefreshCanvas)
  })
})

watch(
  activeCell,
  (activeCell) => {
    const path = activeCell.path

    if (isGroupBy.value && ncIsNullOrUndefined(path)) return

    const dataCache = getDataCache(path)

    const row = activeCell.row !== null ? dataCache.cachedRows.value.get(activeCell.row)?.row : undefined
    const col = row && activeCell.column !== null ? columns.value[activeCell.column]?.columnObj : undefined
    const val = row && col ? row[col.title as string] : undefined
    const rowId = extractPkFromRow(row!, meta.value?.columns as ColumnType[])
    const viewId = view.value?.id

    eventBus.emit(SmartsheetStoreEvents.CELL_SELECTED, { rowId, colId: col?.id, val, viewId })
  },
  {
    deep: true,
  },
)

function selectCell() {
  editEnabled.value = null
  selection.value.startRange({ row: activeCell.value.row, col: activeCell.value.column })
  selection.value.endRange({ row: activeCell.value.row, col: activeCell.value.column })
  requestAnimationFrame(triggerRefreshCanvas)
}

reloadViewDataHook.on(reloadViewDataHookHandler)
reloadVisibleDataHook?.on(triggerReload)
openNewRecordFormHook?.on(openNewRecordHandler)
selectCellHook.on(selectCell)

const { isViewColumnsLoading } = useViewColumnsOrThrow()

watch(
  view,
  async (next, old) => {
    try {
      if (next && next.id !== old?.id && (next.fk_model_id === route.params.viewId || isPublicView.value)) {
        clearTextCache()
        await until(isViewColumnsLoading).toMatch((c) => !c)
        if (isGroupBy.value) {
          await syncGroupCount()
          calculateSlices()
        } else {
          await syncCount()
          calculateSlices()
          updateVisibleRows()
        }
        await loadViewAggregate()
      }
    } catch (e) {
      if (!axios.isCancel(e)) {
        console.error(e)
        message.error(t('msg.errorLoadingData'))
      }
    }
  },
  {
    immediate: true,
  },
)

onBeforeUnmount(() => {
  reloadViewDataHook.off(reloadViewDataHookHandler)
  reloadVisibleDataHook?.off(triggerReload)
  openNewRecordFormHook?.off(openNewRecordHandler)
  selectCellHook.off(selectCell)
})

eventBus.on(async (event, payload) => {
  if (event === SmartsheetStoreEvents.CLEAR_NEW_ROW) {
    selection.value.clear()
    activeCell.value.row = -1
    activeCell.value.column = -1
    removeRowIfNew(payload)
    requestAnimationFrame(triggerRefreshCanvas)
  } else if (event === SmartsheetStoreEvents.FIELD_RELOAD) {
    // This event is triggered when a field is updated
    calculateSlices()
    requestAnimationFrame(triggerRefreshCanvas)
  }
})

function resetActiveCell(path?: Array<number>, force = false) {
  if (!activeCell.value) return

  if (activeCell.value.row >= 0 || activeCell.value.column >= 0 || force) {
    activeCell.value = { row: -1, column: -1, path: path ?? [] }
    editEnabled.value = null
    isFillHandlerActive.value = false
    selection.value.clear()
    onActiveCellChanged()
    requestAnimationFrame(triggerRefreshCanvas)
  }
}

onClickOutside(
  wrapperRef,
  (e: MouseEvent) => {
    const element = e.target as HTMLElement
    if (
      isDrawerOrModalExist() ||
      isExpandedCellInputExist() ||
      isLinkDropdownExist() ||
      isGeneralOverlayActive() ||
      (element && hasAncestorWithClass(element, ['ant-select-dropdown', 'nc-dropdown']))
    ) {
      return
    }
    onActiveCellChanged()
    const aggregationOrColumnMenuOpen = document.querySelector(
      '.canvas-aggregation, .canvas-header-column-menu, .canvas-header-add-new-row-menu',
    )
    if (!aggregationOrColumnMenuOpen && isNcDropdownOpen()) return

    openColumnDropdownField.value = null
    openAggregationField.value = null
    openAddNewRowDropdown.value = null
    if (activeCell.value.row >= 0 || activeCell.value.column >= 0 || editEnabled.value) {
      resetActiveCell(activeCell.value.path, true)
    }
  },
  {
    ignore: [
      '.nc-edit-or-add-provider-wrapper',
      '.canvas-aggregation',
      '.canvas-header-column-menu',
      '.canvas-header-add-new-row-menu',
    ],
  },
)

onKeyStroke('Escape', () => {
  openColumnDropdownField.value = null
  openAggregationField.value = null
  openAddNewRowDropdown.value = null
  isDropdownVisible.value = false
})

const increaseMinHeightBy: Record<string, number> = {
  [UITypes.LongText]: 2,
  [UITypes.Formula]: 2,
}

function updateValue(val: any) {
  const title = editEnabled.value?.column?.title ?? ''
  if (!title) return
  if (editEnabled.value?.row?.row) {
    editEnabled.value.row.row[title] = val
  }
}

const isEditableCellVisible = computed(() => !!editEnabled.value?.row)

useActiveKeydownListener(
  isEditableCellVisible,
  (event) => {
    cellEventHook.trigger(event)
  },
  {
    isGridCell: true,
    immediate: true,
  },
)

watch(
  removeInlineAddRecord,
  (newValue) => {
    if (isAddNewRecordGridMode.value && newValue) {
      setAddNewRecordGridMode(!newValue)
    }
  },
  {
    immediate: true,
  },
)

defineExpose({
  scrollToRow: scrollToCell,
  openColumnCreate,
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
    <Scroller
      ref="scroller"
      class="relative sticky"
      :scroll-height="totalHeight"
      :scroll-width="totalWidth"
      :height="height"
      :width="width"
      @scroll="handleScroll"
    >
      <div
        class="sticky top-0 left-0"
        :style="{
          height: `${totalHeight}px`,
          width: `${totalWidth}px`,
        }"
      >
        <Teleport to="body">
          <Transition name="tooltip">
            <Tooltip v-if="tooltipStore.tooltipText" ref="tooltipRef" :tooltip-style="floatingStyles" />
          </Transition>
        </Teleport>
        <NcDropdown
          v-model:visible="isContextMenuOpen"
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
            @mouseleave="handleMouseLeave"
          >
          </canvas>
          <template #overlay>
            <SmartsheetGridCanvasContextCell
              v-if="
                contextMenuTarget &&
                contextMenuTarget?.row !== -1 &&
                (contextMenuTarget?.col !== -1 || selectedRows.length || vSelectedAllRecords || isGroupBy)
              "
              v-model:context-menu-target="contextMenuTarget"
              v-model:selected-all-records="vSelectedAllRecords"
              :selection="selection"
              :columns="columns"
              :active-cell="activeCell"
              :action-manager="actionManager"
              :is-group-by="isGroupBy"
              :get-data-cache="getDataCache"
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
              :read-only="!hasEditPermission"
              :get-rows="getRows"
              :bulk-update-rows="bulkUpdateRows"
              :expand-form="expandForm"
              :clear-selected-range-of-cells="clearSelectedRangeOfCells"
              @click="isContextMenuOpen = false"
              @bulk-update-dlg="bulkUpdataContext"
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
              minHeight: `${editEnabled.minHeight + (increaseMinHeightBy[editEnabled.column.uidt as UITypes] ?? 0)}px`,
              height: `${editEnabled.height}px`,
              borderRadius: '2px',
              willChange: 'top, left, width, height',
            }"
            class="nc-canvas-table-editable-cell-wrapper pointer-events-auto"
            :class="{ [`row-height-${rowHeightEnum ?? 1}`]: true, 'on-stick': isClamped.isStuck }"
          >
            <div
              ref="activeCellElement"
              class="relative w-[calc(100%-5px)] h-[calc(100%-5px)] rounded-br-[9px] bg-white"
              :class="{
                'px-[0.550rem]': !noPadding && !editEnabled.fixed,
                'px-[0.49rem]': editEnabled.fixed,
                'top-[0.5px]': isGroupBy && isClamped.isStuck,
                'top-[2.5px]': isGroupBy,
                'left-[2.5px] ': isGroupBy && !editEnabled.fixed,
                'left-[2px] ': isGroupBy && editEnabled.fixed,
                'left-[-1px] top-[2px]': !isGroupBy && isClamped.isStuck,
                'left-[2px] top-[3.5px]': !isGroupBy && !isClamped.isStuck,
              }"
              @click="cellClickHook.trigger($event)"
            >
              <SmartsheetRow :row="editEnabled.row">
                <template #default="{ state }">
                  <SmartsheetVirtualCell
                    v-if="isVirtualCol(editEnabled.column) && editEnabled.column.title"
                    v-model="editEnabled.row.row[editEnabled.column.title]"
                    :column="editEnabled.column"
                    :row="editEnabled.row"
                    :path="editEnabled.path"
                    active
                    :read-only="!isDataEditAllowed"
                    @save="
                      updateOrSaveRow?.(editEnabled.row, editEnabled.column.title, state, undefined, undefined, editEnabled.path)
                    "
                    @navigate="onNavigate"
                  />
                  <SmartsheetCell
                    v-else
                    :model-value="editEnabled.row.row[editEnabled.column.title]"
                    :column="editEnabled.column"
                    :row-index="editEnabled.rowIndex"
                    :path="editEnabled.path"
                    active
                    edit-enabled
                    :read-only="!isDataEditAllowed"
                    @update:model-value="updateValue"
                    @save="updateOrSaveRow?.(...$event)"
                    @save-with-state="updateOrSaveRow?.(...$event)"
                    @navigate="onNavigate"
                  />
                </template>
              </SmartsheetRow>
            </div>
          </div>
        </div>
      </div>
    </Scroller>

    <template v-if="overlayStyle">
      <NcDropdown
        :trigger="['click']"
        :visible="
          isDropdownVisible &&
          !!(openColumnDropdownField || isCreateOrEditColumnDropdownOpen || openAggregationField || openAddNewRowDropdown)
        "
        :overlay-class-name="`!bg-transparent !min-w-[220px] ${
          !openAggregationField && !openColumnDropdownField && !openAddNewRowDropdown ? '!border-none !shadow-none' : ''
        }`"
        placement="bottomRight"
        @visible-change="onVisibilityChange"
      >
        <div
          v-if="openColumnDropdownField || isCreateOrEditColumnDropdownOpen || openAggregationField || openAddNewRowDropdown"
          :style="overlayStyle"
          class="hide pointer-events-none"
        ></div>
        <template #overlay>
          <Aggregation v-if="openAggregationField" v-model:column="openAggregationField" class="canvas-aggregation" />
          <SmartsheetHeaderColumnMenu
            v-else-if="openColumnDropdownField"
            v-model:is-open="isDropdownVisible"
            :column="openColumnDropdownField"
            class="canvas-header-column-menu"
            @edit="handleEditColumn"
            @add-column="addEmptyColumn($event, true)"
          />
          <AddNewRowMenu
            v-else-if="openAddNewRowDropdown"
            class="canvas-header-add-new-row-menu"
            :path="openAddNewRowDropdown"
            :on-new-record-to-grid-click="onNewRecordToGridClick"
            :on-new-record-to-form-click="onNewRecordToFormClick"
          />

          <div v-if="isCreateOrEditColumnDropdownOpen" class="nc-edit-or-add-provider-wrapper">
            <SmartsheetColumnEditOrAddProvider
              :key="editColumn?.id || 'new'"
              ref="columnEditOrAddProviderRef"
              :column="columnOrder ? null : editColumn"
              :column-position="columnOrder"
              :edit-description="isEditColumnDescription"
              :preload="preloadColumn"
              @submit="closeAddColumnDropdownMenu(!editColumn?.id, $event)"
              @cancel="closeAddColumnDropdownMenu()"
              @mounted="preloadColumn = undefined"
              @click.stop
              @keydown.stop
            />
          </div>
        </template>
      </NcDropdown>
    </template>
    <div class="absolute bottom-12 z-5 left-2" @click.stop>
      <NcDropdown v-if="isAddingEmptyRowAllowed && !removeInlineAddRecord">
        <div class="flex shadow-nc-sm rounded-lg">
          <NcButton
            v-if="isMobileMode"
            v-e="[isAddNewRecordGridMode ? 'c:row:add:grid' : 'c:row:add:form']"
            class="nc-grid-add-new-row"
            size="small"
            type="secondary"
            :shadow="false"
            @click.stop="onNewRecordToFormClick()"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              New Record
            </div>
          </NcButton>
          <NcButton
            v-else
            v-e="[isAddNewRecordGridMode && !isGroupBy ? 'c:row:add:grid' : 'c:row:add:form']"
            class="nc-grid-add-new-row"
            size="small"
            :class="{
              '!rounded-r-none !border-r-0': !isGroupBy,
            }"
            type="secondary"
            :shadow="false"
            @click.stop="isAddNewRecordGridMode && !isGroupBy ? addEmptyRow() : onNewRecordToFormClick()"
          >
            <div data-testid="nc-pagination-add-record" class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              <template v-if="isAddNewRecordGridMode || isGroupBy">
                {{ $t('activity.newRecord') }}
              </template>
              <template v-else> {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}</template>
            </div>
          </NcButton>
          <NcButton
            v-if="!isMobileMode && !isGroupBy"
            size="small"
            class="!rounded-l-none nc-add-record-more-info"
            type="secondary"
            :shadow="false"
          >
            <GeneralIcon icon="arrowUp" />
          </NcButton>
        </div>

        <template #overlay>
          <AddNewRowMenu
            :path="openAddNewRowDropdown"
            :on-new-record-to-grid-click="onNewRecordToGridClick"
            :on-new-record-to-form-click="onNewRecordToFormClick"
          />
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-canvas-table-editable-cell-wrapper {
  @apply sticky !text-small !leading-[18px] overflow-hidden;

  &.on-stick {
    @apply bg-white border-2 !rounded border-[#3366ff];
  }

  &.row-height-1 {
    :deep(.nc-multi-select) {
      height: 28px !important;
    }

    :deep(.nc-single-select) {
      height: 30px !important;
    }

    :deep(.nc-user-select) {
      margin-top: -2px;
      .ant-select-selector {
        @apply !h-7;
      }
    }

    :deep(.nc-cell-datetime:not(.nc-under-ltar)) {
      @apply !py-0.75 !px-1.5;
    }

    :deep(.nc-cell-geodata) {
      @apply !pt-0.5;
    }

    :deep(.nc-virtual-cell-lookup:has(.nc-cell-attachment)) {
      @apply !h-full;
    }
  }

  :deep(.nc-virtual-cell-lookup:has(.nc-virtual-cell-linktoanotherrecord)),
  :deep(.nc-virtual-cell-lookup:has(.nc-virtual-cell-links)) {
    @apply !overflow-hidden;
  }

  :deep(.nc-cell-longtext) {
    @apply !px-[2px];
    .nc-text-area-clamped-text {
      @apply !px-[7px] !pt-[5px];
    }

    .nc-readonly-rich-text-wrapper {
      @apply !pl-2 pt-0.5;
    }
  }

  :deep(.nc-cell-attachment) {
    [data-row-height='1'] {
      @apply -mt-[0.5px];
      .empty-add-files {
        @apply mt-[3px];
      }
    }

    [data-row-height]:not([data-row-height='1']) {
      @apply !pt-2;
      button.add-files,
      button.view-attachments {
        @apply mt-[4px];
      }
    }

    .nc-attachment-image {
      @apply !hover:cursor-pointer;
    }
  }

  :deep(.nc-cell-multiselect) {
    @apply !px-2;
  }

  :deep(.nc-single-select) {
    @apply !h-auto !px-2;
  }

  :deep(.nc-cell-geodata) {
    @apply !pt-2 !h-auto;
  }

  :deep(.nc-cell-user) {
    @apply !h-auto !mt-0.5;
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

  :deep(.nc-cell-datetime:not(.nc-under-ltar)) {
    @apply !py-1 !px-2;
  }

  :deep(.nc-cell-date:not(.nc-under-ltar)),
  :deep(.nc-cell-year:not(.nc-under-ltar)),
  :deep(.nc-cell-time:not(.nc-under-ltar)) {
    @apply !h-auto !py-1;
  }

  :deep(.nc-virtual-cell-qrcode),
  :deep(.nc-virtual-cell-barcode) {
    @apply !h-full;
  }

  :deep(.nc-virtual-cell.nc-virtual-cell-linktoanotherrecord > div) {
    @apply min-h-7;
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

  :deep(.nc-cell),
  :deep(.nc-virtual-cell) {
    &:not(.nc-cell-date):not(.nc-cell-datetime):not(.nc-cell-year):not(.nc-cell-time) {
      input {
        @apply min-h-[26px] !important;
      }
    }
  }

  :deep(.nc-cell-datetime.nc-under-ltar) {
    @apply !py-0 !leading-[16px];
  }

  :deep(.nc-under-ltar .nc-cell-field div) {
    @apply !leading-[16px];
  }
}
</style>
