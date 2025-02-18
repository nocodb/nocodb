<script setup lang="ts">
import {
  type ButtonType,
  type ColumnType,
  type TableType,
  UITypes,
  type ViewType,
  ViewTypes,
  isAIPromptCol,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isOrderCol,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'

import axios from 'axios'
import { useColumnDrag } from './useColumnDrag'
import { useRowDragging } from './useRowDragging'
import { type CellRange, NavigateDir, type Row, type ViewActionState } from '#imports'

const props = defineProps<{
  totalRows: number
  data: Map<number, Row>
  rowHeightEnum?: number
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
  callAddEmptyRow?: (addAfter?: number) => Row | undefined
  deleteRow?: (rowIndex: number, undo?: boolean) => Promise<void>
  updateOrSaveRow?: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
  ) => Promise<any>
  deleteSelectedRows?: () => Promise<void>
  clearInvalidRows?: () => void
  deleteRangeOfRows?: (cellRange: CellRange) => Promise<void>
  updateRecordOrder: (originalIndex: number, targetIndex: number | null) => Promise<void>
  bulkUpdateRows?: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  bulkDeleteAll?: () => Promise<void>
  bulkUpsertRows?: (
    insertRows: Row[],
    updateRows: [],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    newColumns?: Partial<ColumnType>[],
  ) => Promise<void>
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
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

const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

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
  removeRowIfNew,
  clearInvalidRows,
  updateRecordOrder,
  applySorting,
  bulkDeleteAll,
} = props

// Injections
const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const fields = inject(FieldsInj, ref([]))

const readOnly = inject(ReadonlyInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isPublicView = inject(IsPublicInj, ref(false))

const route = useRoute()

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const reloadVisibleDataHook = inject(ReloadVisibleDataHookInj, undefined)

const { isMobileMode, isAddNewRecordGridMode, setAddNewRecordGridMode } = useGlobal()

const { isPkAvail, isSqlView, eventBus, allFilters, sorts } = useSmartsheetStoreOrThrow()

const { $e, $api } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const { addUndo, clone, defineViewScope } = useUndoRedo()

const {
  isViewColumnsLoading: _isViewColumnsLoading,
  updateGridViewColumn,
  gridViewCols,
  metaColumnById,
  resizingColOldWith,
} = useViewColumnsOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const { paste } = usePaste()

const { addLTARRef, syncLTARRefs, clearLTARCell, cleaMMCell } = useSmartsheetLtarHelpersOrThrow()

const { loadViewAggregate } = useViewAggregateOrThrow()

const { generateRows, generatingRows, generatingColumnRows, generatingColumns, aiIntegrations } = useNocoAi()

const { isFeatureEnabled } = useBetaFeatureToggle()

const tableBodyEl = ref<HTMLElement>()

const gridWrapper = ref<HTMLElement>()

const fillHandle = ref<HTMLElement>()

const isViewColumnsLoading = computed(() => _isViewColumnsLoading.value || !meta.value)

const resizingColumn = ref(false)

const isPlaywright = computed(() => ncIsPlaywright())

const columnWidthLimit = {
  [UITypes.Attachment]: {
    minWidth: 80,
    maxWidth: Number.POSITIVE_INFINITY,
  },
  [UITypes.Button]: {
    minWidth: 100,
    maxWidth: 320,
  },
}
const normalizedWidth = (col: ColumnType, width: number) => {
  if (col.uidt! in columnWidthLimit) {
    const { minWidth, maxWidth } = columnWidthLimit[col.uidt]

    if (minWidth < width && width < maxWidth) return width
    if (width < minWidth) return minWidth
    if (width > maxWidth) return maxWidth
  }
  return width
}

const onresize = (colID: string | undefined, event: any) => {
  if (!colID || !ncIsString(event?.detail)) return

  const size = event.detail.split('px')[0]

  updateGridViewColumn(colID, { width: `${normalizedWidth(metaColumnById.value[colID], size)}px` })
}

const onXcResizing = (cn: string | undefined, event: any) => {
  if (!cn || !ncIsString(event?.detail)) return

  const size = event.detail.split('px')[0]
  gridViewCols.value[cn].width = `${normalizedWidth(metaColumnById.value[cn], size)}px`

  refreshFillHandle()
}

const onXcStartResizing = (cn: string | undefined, event: any) => {
  if (!cn) return
  resizingColOldWith.value = event.detail
  resizingColumn.value = true
}

const cachedRows = toRef(props, 'data')

const rowSortRequiredRows = toRef(props, 'rowSortRequiredRows')

const totalRows = toRef(props, 'totalRows')

const chunkStates = toRef(props, 'chunkStates')

const isBulkOperationInProgress = toRef(props, 'isBulkOperationInProgress')

const rowHeight = computed(() => (isMobileMode.value ? 56 : rowHeightInPx[`${props.rowHeightEnum}`] ?? 32))

const rowSlice = reactive({
  start: 0,
  end: 100,
})

const CHUNK_SIZE = 50
const BUFFER_SIZE = 100
const INITIAL_LOAD_SIZE = 100
const PREFETCH_THRESHOLD = 40

const fetchChunk = async (chunkId: number, isInitialLoad = false) => {
  if (chunkStates.value[chunkId]) return

  const offset = chunkId * CHUNK_SIZE
  const limit = isInitialLoad ? INITIAL_LOAD_SIZE : CHUNK_SIZE

  if (offset >= totalRows.value) {
    return
  }

  chunkStates.value[chunkId] = 'loading'
  if (isInitialLoad) {
    chunkStates.value[chunkId + 1] = 'loading'
  }

  try {
    const newItems = await loadData({ offset, limit })
    newItems.forEach((item) => cachedRows.value.set(item.rowMeta.rowIndex, item))

    chunkStates.value[chunkId] = 'loaded'
    if (isInitialLoad) {
      chunkStates.value[chunkId + 1] = 'loaded'
    }
  } catch (error) {
    console.error(`Error fetching chunk ${chunkId}:`, error)
    chunkStates.value[chunkId] = undefined
    if (isInitialLoad) {
      chunkStates.value[chunkId + 1] = undefined
    }
  }
}

const tableState = reactive<ViewActionState>({
  viewProgress: null,
  rowProgress: new Map(),
  cellProgress: new Map(),
})

const visibleRows = computed(() => {
  const { start, end } = rowSlice

  return Array.from({ length: Math.min(end, totalRows.value) - start }, (_, i) => {
    const rowIndex = start + i

    const row = cachedRows.value.get(rowIndex)

    if (!row) return { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } }

    const rowId = extractPkFromRow(row.row, meta.value?.columns ?? [])

    row.rowMeta.rowProgress = tableState.rowProgress.get(String(rowId))
    return row
  })
})

const totalMaxPlaceholderRows = computed(() => {
  if (!gridWrapper.value || rowSlice.start <= 1) {
    return 0
  }

  return parseInt(`${gridWrapper.value?.clientHeight / (rowHeight.value || 32)}`) * 3
})

const placeholderStartRows = computed(() => {
  const result = {
    length: rowSlice.start > 1 ? Math.min(rowSlice.start - 1, totalMaxPlaceholderRows.value) : 0,
    rowHeight: rowHeight.value!,
    totalRowHeight: 0,
  }

  result.totalRowHeight = result.length * result.rowHeight

  return result
})

const placeholderEndRows = computed(() => {
  const result = {
    length: rowSlice.end < totalRows.value - 1 ? Math.min(totalRows.value - 1 - rowSlice.end, totalMaxPlaceholderRows.value) : 0,
    rowHeight: rowHeight.value!,
    totalRowHeight: 0,
  }
  result.totalRowHeight = result.length * result.rowHeight

  return result
})

const topOffset = computed(() => {
  return rowHeight.value! * (rowSlice.start - placeholderStartRows.value.length)
})

let debounceTimeout: any = null // To store the debounced timeout
const debounceDelay = 50 // Delay in ms after the last scroll event

const updateVisibleRows = async (fromCalculateSlice = false) => {
  const { start, end } = rowSlice

  const firstChunkId = Math.floor(start / CHUNK_SIZE)
  const lastChunkId = Math.floor((end - 1) / CHUNK_SIZE)

  const chunksToFetch = new Set<number>()

  // Collect chunks that need to be fetched (i.e., chunks that are not loaded yet)
  for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
    if (!chunkStates.value[chunkId]) chunksToFetch.add(chunkId)
  }

  // Add adjacent chunks for prefetching
  const nextChunkId = lastChunkId + 1
  if (end % CHUNK_SIZE > CHUNK_SIZE - PREFETCH_THRESHOLD && !chunkStates.value[nextChunkId]) {
    chunksToFetch.add(nextChunkId)
  }

  const prevChunkId = firstChunkId - 1
  if (prevChunkId >= 0 && start % CHUNK_SIZE < PREFETCH_THRESHOLD && !chunkStates.value[prevChunkId]) {
    chunksToFetch.add(prevChunkId)
  }

  // Early exit if no chunks need to be fetched
  if (chunksToFetch.size === 0) return

  // Clear the previous timeout if any
  clearTimeout(debounceTimeout)

  // Debounced execution
  debounceTimeout = setTimeout(
    async () => {
      // Execute the function after the debounce delay has passed
      const isInitialLoad = firstChunkId === 0 && !chunkStates.value[0]

      if (isInitialLoad) {
        await fetchChunk(0, true)
        chunksToFetch.delete(0)
        chunksToFetch.delete(1)
      }

      // Fetch the necessary chunks concurrently
      await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId)))

      // Clear cache for chunks that are no longer visible
      const bufferStart = Math.max(0, start - BUFFER_SIZE)
      const bufferEnd = Math.min(totalRows.value, end + BUFFER_SIZE)

      // Cache clearing with buffer
      clearCache(bufferStart, bufferEnd)
    },
    fromCalculateSlice ? debounceDelay : 25,
  )
}

const { isUIAllowed, isDataReadOnly } = useRoles()
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))
const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('fieldAdd') && !isSqlView.value)

const { onDrag, onDragStart, onDragEnd, draggedCol, dragColPlaceholderDomRef, toBeDroppedColId } = useColumnDrag({
  fields,
  tableBodyEl,
  gridWrapper,
})

const isOrderColumnExists = computed(() => (meta.value?.columns ?? []).some((col) => isOrderCol(col)))

const isInsertBelowDisabled = computed(() => allFilters.value?.length || sorts.value?.length || isPublicView.value)

const isRowReorderDisabled = computed(() => sorts.value?.length || isPublicView.value || !isPkAvail.value)

const addColumnDropdown = ref(false)

const disableUrlOverlay = ref(false)

const preloadColumn = ref<any>()

const scrolling = ref(false)

const switchingTab = ref(false)

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const editEnabled = ref(false)

const isGridCellMouseDown = ref(false)

const _contextMenu = ref(false)

const selectedRows = toRef(props, 'selectedRows')

const contextMenu = computed({
  get: () => {
    if (selectedRows.value.length && isDataReadOnly.value) return false
    return _contextMenu.value
  },
  set: (val) => {
    _contextMenu.value = val
  },
})

const contextMenuClosing = ref(false)

const contextMenuTarget = ref<{ row: number; col: number } | null>(null)

const showContextMenu = (e: MouseEvent, target?: { row: number; col: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const isJsonExpand = ref(false)
provide(JsonExpandInj, isJsonExpand)

const isKeyDown = ref(false)

const isReadonly = (col: ColumnType) => {
  return (
    isSystemColumn(col) ||
    isLookup(col) ||
    isRollup(col) ||
    isFormula(col) ||
    isButton(col) ||
    isVirtualCol(col) ||
    isCreatedOrLastModifiedTimeCol(col) ||
    isCreatedOrLastModifiedByCol(col)
  )
}

const colMeta = computed(() => {
  return fields.value.map((col) => {
    return {
      isVirtualCol: isVirtualCol(col),
      isReadonly: isReadonly(col),
    }
  })
})

async function clearCell(ctx: { row: number; col: number } | null, skipUpdate = false) {
  // If the data is readonly, return
  // If the cell is not available, return
  // If the user doesn't have edit permission, return
  // If the cell is a virtual column and not Links/Ltar, return
  if (
    isDataReadOnly.value ||
    !ctx ||
    !hasEditPermission.value ||
    (!isLinksOrLTAR(fields.value[ctx.col]) && isVirtualCol(fields.value[ctx.col]))
  )
    return

  // If the cell is readonly, return
  if (colMeta.value[ctx.col].isReadonly) return

  // Get the row and column object
  const rowObj = cachedRows.value.get(ctx.row)

  if (!rowObj) {
    return
  }

  const columnObj = fields.value[ctx.col]

  if (isVirtualCol(columnObj)) {
    let mmClearResult

    if (isMm(columnObj) && rowObj) {
      mmClearResult = await cleaMMCell(rowObj, columnObj)
    }

    addUndo({
      undo: {
        fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row, mmClearResult: any[]) => {
          const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
          const rowObj = cachedRows.value.get(ctx.row)
          const columnObj = fields.value[ctx.col]
          if (
            rowObj &&
            columnObj.title &&
            rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) &&
            columnObj.id === col.id
          ) {
            if (isBt(columnObj) || isOo(columnObj)) {
              rowObj.row[columnObj.title] = row.row[columnObj.title]

              await addLTARRef(rowObj, rowObj.row[columnObj.title], columnObj)
              await syncLTARRefs(rowObj, rowObj.row)
            } else if (isMm(columnObj)) {
              await $api.dbDataTableRow.nestedLink(
                meta.value?.id as string,
                columnObj.id as string,
                encodeURIComponent(rowId as string),
                mmClearResult,
              )
              rowObj.row[columnObj.title] = mmClearResult?.length ? mmClearResult?.length : null
            }

            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            activeCell.col = ctx.col
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            activeCell.row = ctx.row
            scrollToCell?.()
          } else {
            throw new Error(t('msg.recordCouldNotBeFound'))
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj), mmClearResult],
      },
      redo: {
        fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row) => {
          const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
          const rowObj = cachedRows.value.get(ctx.row)
          const columnObj = fields.value[ctx.col]
          if (rowObj && rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) && columnObj.id === col.id) {
            if (isBt(columnObj) || isOo(columnObj)) {
              await clearLTARCell(rowObj, columnObj)
            } else if (isMm(columnObj)) {
              await cleaMMCell(rowObj, columnObj)
            }
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            activeCell.col = ctx.col
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            activeCell.row = ctx.row
            scrollToCell?.()
          } else {
            throw new Error(t('msg.recordCouldNotBeFound'))
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj)],
      },
      scope: defineViewScope({ view: view.value }),
    })
    if (isBt(columnObj) || isOo(columnObj)) await clearLTARCell(rowObj, columnObj)

    return
  }

  if (columnObj.title) {
    // handle Checkbox and rating fields in a special way
    switch (columnObj.uidt) {
      case UITypes.Checkbox:
        rowObj.row[columnObj.title] = false
        break
      case UITypes.Rating:
        rowObj.row[columnObj.title] = 0
        break
      default:
        rowObj.row[columnObj.title] = null
        break
    }
  }

  if (!skipUpdate) {
    // update/save cell value
    await updateOrSaveRow?.(rowObj, columnObj.title)
  }
}

function makeEditable(row: Row, col: ColumnType) {
  // If the cell is readonly, return
  if (!hasEditPermission.value || editEnabled.value || readOnly.value || isSystemColumn(col)) {
    return
  }

  if (!isPkAvail.value && !row.rowMeta.new) {
    // Update not allowed for table which doesn't have primary Key or for new rows
    message.info(t('msg.info.updateNotAllowedWithoutPK'))
    return
  }

  if (col.ai) {
    // Auto Increment field is not editable
    message.info(t('msg.info.autoIncFieldNotEditable'))
    return
  }

  if (col.pk && !row.rowMeta.new) {
    // Editing primary key not supported
    message.info(t('msg.info.editingPKnotSupported'))
    return
  }

  if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(col.uidt as UITypes)) {
    return
  }

  return (editEnabled.value = true)
}

const isAddingEmptyRowAllowed = computed(() => hasEditPermission.value && !isSqlView.value && !isPublicView.value)

const visibleColLength = computed(() => fields.value?.length)

const dummyColumnDataForLoading = computed(() => {
  const length = 10
  return Array.from({ length: length + 1 }).map(() => ({}))
})

const cellMeta = computed(() => {
  return visibleRows.value?.map((row) => {
    const rowId = extractPkFromRow(row.row, meta.value?.columns ?? [])

    const cellStates = tableState.cellProgress.get(rowId)

    return fields.value.map((col) => {
      return {
        isColumnRequiredAndNull: isColumnRequiredAndNull(col, row.row),
        cellProgress: cellStates?.get(col.id),
      }
    })
  })
})

function openColumnCreate(data: any) {
  scrollToAddNewColumnHeader('instant')

  setTimeout(() => {
    addColumnDropdown.value = true
    preloadColumn.value = data
  }, 500)
}

function closeAddColumnDropdownMenu(scrollToLastCol = false) {
  columnOrder.value = null
  addColumnDropdown.value = false
  preloadColumn.value = {}
  if (scrollToLastCol) {
    setTimeout(() => {
      scrollToAddNewColumnHeader('instant')
    }, 200)
  }
}

async function openNewRecordHandler() {
  // Add an empty row
  const newRow = await addEmptyRow(totalRows.value + 1, true)
  // Expand the form
  if (newRow) expandForm?.(newRow, undefined, true)
}

const onDraftRecordClick = () => {
  openNewRecordFormHook.trigger()
}

const onNewRecordToGridClick = () => {
  setAddNewRecordGridMode(true)
  addEmptyRow()
}

const onNewRecordToFormClick = () => {
  setAddNewRecordGridMode(false)
  onDraftRecordClick()
}

const numColHeader = ref<HTMLElement | null>(null)
const primaryColHeader = ref<HTMLElement | null>(null)

const getContainerScrollForElement = (
  childPos: {
    top: number
    right: number
    bottom: number
    left: number
  },
  container: HTMLElement,
  offset?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  },
) => {
  const parentPos = container.getBoundingClientRect()

  // provide an extra offset to show the prev/next/up/bottom cell
  const extraOffset = 15

  // Use refs instead of querySelector
  const numColWidth = numColHeader.value?.getBoundingClientRect().width ?? 0
  const primaryColWidth = primaryColHeader.value?.getBoundingClientRect().width ?? 0

  const stickyColsWidth = numColWidth + primaryColWidth

  const relativePos = {
    right: childPos.right + numColWidth - parentPos.width - container.scrollLeft,
    left: childPos.left + numColWidth - container.scrollLeft - stickyColsWidth,
    bottom: childPos.bottom - parentPos.height - container.scrollTop,
    top: childPos.top - container.scrollTop,
  }

  const scroll = {
    top: 0,
    left: 0,
  }

  /*
   * If the element is to the right of the container, scroll right (positive)
   * If the element is to the left of the container, scroll left (negative)
   */
  scroll.left =
    relativePos.right + (offset?.right || 0) > 0
      ? container.scrollLeft + relativePos.right + (offset?.right || 0) + extraOffset
      : relativePos.left - (offset?.left || 0) < 0
      ? container.scrollLeft + relativePos.left - (offset?.left || 0) - extraOffset
      : container.scrollLeft

  /*
   * If the element is below the container, scroll down (positive)
   * If the element is above the container, scroll up (negative)
   */
  scroll.top =
    relativePos.bottom + (offset?.bottom || 0) > 0
      ? container.scrollTop + relativePos.bottom + (offset?.bottom || 0) + extraOffset
      : relativePos.top - (offset?.top || 0) < 0
      ? container.scrollTop + relativePos.top - (offset?.top || 0) - extraOffset
      : container.scrollTop

  return scroll
}

const onActiveCellChanged = () => {
  clearInvalidRows?.()
  if (rowSortRequiredRows.value.length) {
    applySorting?.(rowSortRequiredRows.value)
  }
}

const isOpen = ref(false)

const isDeleteAllModalIsOpen = ref(false)

async function deleteAllRecords() {
  isDeleteAllModalIsOpen.value = true

  const { close } = useDialog(resolveComponent('DlgRecordDeleteAll'), {
    'modelValue': isDeleteAllModalIsOpen,
    'rows': totalRows.value,
    'onUpdate:modelValue': closeDlg,
    'onDeleteAll': async () => {
      await bulkDeleteAll?.()
      closeDlg()
      vSelectedAllRecords.value = false
    },
  })

  function closeDlg() {
    isOpen.value = false
    close(200)
  }

  await until(isDeleteAllModalIsOpen).toBe(false)
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
  isOpen.value = true
  const options = {
    continue: false,
    expand: true,
  }
  const { close } = useDialog(resolveComponent('DlgRecordUpsert'), {
    'modelValue': isOpen,
    'newRows': newRows,
    'newColumns': newColumns,
    'cellsOverwritten': cellsOverwritten,
    'rowsUpdated': rowsUpdated,
    'onUpdate:expand': closeDialog,
    'onUpdate:modelValue': closeDlg,
  })
  function closeDlg() {
    isOpen.value = false
    close(1000)
  }
  async function closeDialog(expand: boolean) {
    options.continue = true
    options.expand = expand
    close(1000)
  }
  await until(isOpen).toBe(false)
  return options
}

const {
  selectRangeMap,
  fillRangeMap,
  activeCell,
  handleMouseDown,
  handleMouseOver,
  handleCellClick: _handleCellClick,
  clearSelectedRange,
  copyValue,
  isCellActive,
  resetSelectedRange,
  makeActive,
  selectedRange,
  isFillMode,
  metaKey,
} = useMultiSelect(
  meta,
  fields,
  cachedRows,
  totalRows,
  editEnabled,
  isPkAvail,
  contextMenu,
  clearCell,
  clearSelectedRangeOfCells,
  makeEditable,
  scrollToCell,
  expandRows,
  (e: KeyboardEvent) => {
    const activeDropdownEl = document.querySelector(
      '.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active',
    )
    if (activeDropdownEl) {
      e.preventDefault()
      return true
    }

    if (isExpandedCellInputExist()) return

    // skip keyboard event handling if there is a drawer / modal
    if (isDrawerOrModalExist() || isLinkDropdownExist()) {
      return true
    }
    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
    const altOrOptionKey = e.altKey
    if (e.key === ' ') {
      const isRichModalOpen = isExpandedCellInputExist()

      if (isCellActive.value && !editEnabled.value && hasEditPermission.value && activeCell.row !== null && !isRichModalOpen) {
        e.preventDefault()
        const row = cachedRows.value.get(activeCell.row)
        expandForm?.(row)
        return true
      }
    } else if (e.key === 'Escape') {
      if (editEnabled.value) {
        editEnabled.value = false
        return true
      }
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // add a line break for types like LongText / JSON
        return true
      }
      if (editEnabled.value) {
        editEnabled.value = false
        return true
      }
    } else if (e.key === 'Tab') {
      if (!e.shiftKey && activeCell.row === totalRows.value - 1 && activeCell.col === fields.value?.length - 1) {
        e.preventDefault()
        if (isAddingEmptyRowAllowed.value) {
          isKeyDown.value = true

          return true
        }
        return true
      } else if (e.shiftKey && activeCell.row === 0 && activeCell.col === 0) {
        e.preventDefault()
        return true
      }
    }
    if (cmdOrCtrl) {
      if (!isCellActive.value) return

      // cmdOrCtrl+shift handled in useMultiSelect
      if (e.shiftKey) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = 0
          activeCell.col = activeCell.col ?? 0

          selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
          selectedRange.endRange({ row: activeCell.row, col: activeCell.col })

          scrollToCell?.(undefined, undefined, 'instant')
          editEnabled.value = false
          onActiveCellChanged()

          return true
        case 'ArrowDown':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = totalRows.value - 1
          activeCell.col = activeCell.col ?? 0

          selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
          selectedRange.endRange({ row: activeCell.row, col: activeCell.col })

          scrollToCell?.(undefined, undefined, 'instant')
          editEnabled.value = false
          onActiveCellChanged()

          return true
        case 'ArrowRight':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = fields.value?.length - 1

          selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
          selectedRange.endRange({ row: activeCell.row, col: activeCell.col })

          scrollToCell?.()
          editEnabled.value = false
          return true
        case 'ArrowLeft':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = 0

          selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
          selectedRange.endRange({ row: activeCell.row, col: activeCell.col })

          scrollToCell?.()
          editEnabled.value = false
          return true
      }
    }
    if (altOrOptionKey) {
      switch (e.keyCode) {
        case 82: {
          // ALT + R
          if (isAddingEmptyRowAllowed.value) {
            $e('c:shortcut', { key: 'ALT + R' })
            addEmptyRow()
            activeCell.row = totalRows.value - 1
            activeCell.col = 0
            resetSelectedRange()
            nextTick(() => {
              ;(document.querySelector('td.cell.active') as HTMLInputElement | HTMLTextAreaElement)?.scrollIntoView({
                behavior: 'smooth',
              })
            })
          }
          break
        }
        case 67: {
          // ALT + C
          if (isAddingColumnAllowed.value) {
            $e('c:shortcut', { key: 'ALT + C' })
            scrollToAddNewColumnHeader('instant')

            setTimeout(() => {
              addColumnDropdown.value = true
            }, 250)
          }
          break
        }
      }
    }
  },
  async (ctx: { row: number; col?: number; updatedColumnTitle?: string }) => {
    const rowObj = cachedRows.value.get(ctx.row)
    const columnObj = ctx.col !== undefined ? fields.value[ctx.col] : null

    if (!rowObj || !columnObj) {
      return
    }

    if (!ctx.updatedColumnTitle && isVirtualCol(columnObj)) {
      return
    }

    // See DateTimePicker.vue for details
    const row = cachedRows.value.get(ctx.row)
    if (row) {
      const updatedRow = {
        ...row,
        rowMeta: {
          ...row.rowMeta,
          isUpdatedFromCopyNPaste: {
            ...(row.rowMeta.isUpdatedFromCopyNPaste || {}),
            [(ctx.updatedColumnTitle || columnObj.title) as string]: true,
          },
        },
      }
      cachedRows.value.set(ctx.row, updatedRow)
    }

    // update/save cell value
    await updateOrSaveRow?.(rowObj, ctx.updatedColumnTitle || columnObj.title)
  },
  bulkUpdateRows,
  bulkUpsertRows,
  fillHandle,
  view,
  undefined,
  undefined,
  fetchChunk,
  onActiveCellChanged,
)

function scrollToRow(row?: number) {
  clearSelectedRange()
  makeActive(row ?? totalRows.value - 1, 0)
  selectedRange.startRange({ row: activeCell.row!, col: activeCell.col! })
  scrollToCell?.(row)
}

async function saveEmptyRow(rowObj: Row, before?: string) {
  await updateOrSaveRow?.(rowObj, null, null, { metaValue: meta.value, viewMetaValue: view.value }, before)
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
    scrollToRow(row ?? totalRows.value - 1)
  })

  return rowObj
}

const confirmDeleteRow = (row: number) => {
  try {
    deleteRow?.(row)

    if (selectedRange.isRowInRange(row)) {
      clearSelectedRange()
    }

    // If the active cell is in the row, clear the active cell
    if (activeCell.row === row) {
      activeCell.row = null
      activeCell.col = null
    }
  } catch (e: any) {
    message.error(e.message)
  }
}

const commentRow = (rowId: number) => {
  try {
    // set the expanded form comment mode
    isExpandedFormCommentMode.value = true

    const row = cachedRows.value.get(rowId)
    if (expandForm) {
      expandForm(row)
    }

    activeCell.row = null
    activeCell.col = null
    selectedRange.clear()
  } catch (e: any) {
    message.error(e.message)
  }
}

const deleteSelectedRangeOfRows = () => {
  deleteRangeOfRows?.(selectedRange).then(() => {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null
  })
}

const isSelectedOnlyAI = computed(() => {
  // selectedRange
  if (selectedRange.start.col === selectedRange.end.col) {
    const field = fields.value[selectedRange.start.col]
    return {
      enabled: isAIPromptCol(field) || isAiButton(field),
      disabled: !(field?.colOptions as ButtonType)?.fk_integration_id,
    }
  }

  return {
    enabled: false,
    disabled: false,
  }
})

const isSelectedOnlyScript = computed(() => {
  // selectedRange
  if (selectedRange.start.col === selectedRange.end.col) {
    const field = fields.value[selectedRange.start.col]
    return {
      enabled: isScriptButton(field),
      disabled: false,
    }
  }

  return {
    enabled: false,
    disabled: false,
  }
})

const { runScript } = useScriptExecutor()

const bulkExecuteScript = () => {
  if (!isSelectedOnlyScript.value.enabled || !meta?.value?.id || !meta.value.columns) return

  const field = fields.value[selectedRange.start.col]

  const rows = Array.from(cachedRows.value.values()).slice(selectedRange.start.row, selectedRange.end.row + 1)

  for (const row of rows) {
    const pk = extractPkFromRow(row.row, meta.value.columns)
    runScript((field.colOptions as ButtonType).fk_script_id!, row.row, {
      pk,
      fieldId: field.id,
    })
  }
}

const isAIFillMode = computed(() => metaKey.value && isFeatureEnabled(FEATURE_FLAG.AI_FEATURES))

const generateAIBulk = async () => {
  if (!isSelectedOnlyAI.value.enabled || !meta?.value?.id || !meta.value.columns) return

  const field = fields.value[selectedRange.start.col]

  if (!field.id) return

  const rows = Array.from(cachedRows.value.values()).slice(selectedRange.start.row, selectedRange.end.row + 1)

  if (!rows || rows.length === 0) return

  let outputColumnIds = [field.id]

  if (isAiButton(field)) {
    outputColumnIds =
      ncIsString(field.colOptions?.output_column_ids) && field.colOptions.output_column_ids.split(',').length > 0
        ? field.colOptions.output_column_ids.split(',')
        : []
  }

  const pks = rows.map((row) => extractPkFromRow(row.row, meta.value!.columns!)).filter((pk) => pk !== null)

  generatingRows.value.push(...pks)
  generatingColumnRows.value.push(field.id)

  generatingColumns.value.push(...outputColumnIds)

  const res = await generateRows(meta.value.id, field.id, pks)

  if (res) {
    // find rows using pk and update with generated rows
    for (const row of res) {
      const oldRow = Array.from(cachedRows.value.values()).find(
        (r) => extractPkFromRow(r.row, meta.value!.columns!) === extractPkFromRow(row, meta.value!.columns!),
      )

      if (oldRow) {
        oldRow.row = { ...oldRow.row, ...row }
      }
    }
  }

  generatingRows.value = generatingRows.value.filter((pk) => !pks.includes(pk))
  generatingColumnRows.value = generatingColumnRows.value.filter((v) => v !== field.id)
  generatingColumns.value = generatingColumns.value.filter((v) => !outputColumnIds?.includes(v))
}

onClickOutside(tableBodyEl, (e) => {
  // do nothing if mousedown on the scrollbar (scrolling)
  if (scrolling.value || resizingColumn.value) {
    return
  }

  // do nothing if context menu was open
  if (contextMenu.value) return

  // do nothing active cell is not set
  if (activeCell.row === null || activeCell.col === null) return

  // do nothing if the cell is readonly
  const isRichModalOpen = isExpandedCellInputExist()
  if (isRichModalOpen) return

  const activeCol = fields.value[activeCell.col]

  if (editEnabled.value && (isVirtualCol(activeCol) || activeCol.uidt === UITypes.JSON)) return

  // skip if fill mode is active
  if (isFillMode.value) return

  // ignore unselecting if clicked inside or on the picker(Date, Time, DateTime, Year)
  // or single/multi select options
  const activePickerOrDropdownEl = document.querySelector(
    '.nc-picker-datetime.active,.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active,.nc-dropdown-user-select-cell.active,.nc-picker-date.active,.nc-picker-year.active,.nc-picker-time.active,.nc-link-dropdown-root',
  )
  if (
    e.target &&
    activePickerOrDropdownEl &&
    (activePickerOrDropdownEl === e.target || activePickerOrDropdownEl?.contains(e.target as Element))
  )
    return

  // skip if drawer / modal is active
  if (isDrawerOrModalExist()) {
    return
  }
  onActiveCellChanged()

  // clear the active cell and selected range
  clearSelectedRange()
  activeCell.row = null
  activeCell.col = null
})

const onNavigate = (dir: NavigateDir) => {
  if (activeCell.row === null || activeCell.col === null) return

  editEnabled.value = false
  clearSelectedRange()

  switch (dir) {
    case NavigateDir.NEXT:
      if (activeCell.row < totalRows.value - 1) {
        activeCell.row++
      } else {
        addEmptyRow()
        activeCell.row++
      }
      break
    case NavigateDir.PREV:
      if (activeCell.row > 0) {
        activeCell.row--
      }
      break
  }
  nextTick(() => {
    scrollToCell()
  })
}

async function clearSelectedRangeOfCells() {
  if (!hasEditPermission.value || isDataReadOnly.value) return

  const start = selectedRange.start
  const end = selectedRange.end

  const startCol = Math.min(start.col, end.col)
  const endCol = Math.max(start.col, end.col)

  const cols = fields.value.slice(startCol, endCol + 1)
  // Get rows in the selected range
  const rows = Array.from(cachedRows.value.values()).slice(start.row, end.row + 1)

  const props = []
  let isInfoShown = false

  for (const row of rows) {
    for (const col of cols) {
      if (!row || !col || !col.title) continue

      // TODO handle LinkToAnotherRecord
      if (isVirtualCol(col)) {
        if ((isBt(col) || isOo(col) || isMm(col)) && !isInfoShown) {
          message.info(t('msg.info.groupClearIsNotSupportedOnLinksColumn'))
          isInfoShown = true
        }
        continue
      }

      // skip readonly columns
      if (isReadonly(col)) continue

      row.row[col.title] = null
      props.push(col.title)
    }
  }

  await bulkUpdateRows?.(rows, props)
}

const colPositions = computed(() => {
  return fields.value
    .filter((col) => col.id && gridViewCols.value[col.id] && gridViewCols.value[col.id].width && gridViewCols.value[col.id].show)
    .map((col) => {
      return +gridViewCols.value[col.id!]!.width!.replace('px', '') || 180
    })
    .reduce(
      (acc, width, i) => {
        acc.push(acc[i] + width)
        return acc
      },
      [0],
    )
})

const scrollLeft = ref(0)

const scrollTop = ref(0)

function scrollToCell(row?: number | null, col?: number | null, behaviour: ScrollBehavior = 'instant') {
  row = row ?? activeCell.row
  col = col ?? activeCell.col

  if (row !== null && col !== null && gridWrapper.value) {
    // calculate cell position
    const td = {
      top: row * rowHeight.value,
      left: colPositions.value[col],
      right:
        col === fields.value.length - 1 ? colPositions.value[colPositions.value.length - 1] + 180 : colPositions.value[col + 1],
      bottom: (row + 1) * rowHeight.value,
    }

    const tdScroll = getContainerScrollForElement(td, gridWrapper.value, {
      top: 9,
      bottom: 32 + 9,
      right: 9,
    })

    // if first column set left to 0 since it's sticky it will be visible and calculated value will be wrong
    // setting left to 0 will make it scroll to the left
    if (col === 0) {
      tdScroll.left = 0
    }

    const scrollOptions = {
      top: tdScroll.top,
      left: tdScroll.left,
      behavior: behaviour,
    }

    if (row === totalRows.value - 1) {
      scrollOptions.top = gridWrapper.value.scrollHeight
      if (col === fields.value.length - 1) {
        scrollOptions.left = gridWrapper.value.scrollWidth
      }
    } else if (col === fields.value.length - 1) {
      scrollOptions.left = gridWrapper.value.scrollWidth
    }
    gridWrapper.value.scrollTo(scrollOptions)
  }
}

const temporaryNewRowStore = ref<Row[]>([])

const saveOrUpdateRecords = async (
  args: { metaValue?: TableType; viewMetaValue?: ViewType; data?: any; keepNewRecords?: boolean } = {},
) => {
  for (const currentRow of args.data || cachedRows.value.entries()) {
    if (currentRow.rowMeta?.fromExpandedForm) continue

    /** if new record save row and save the LTAR cells */
    if (currentRow.rowMeta?.new) {
      const beforeSave = clone(currentRow)
      const savedRow = await updateOrSaveRow?.(currentRow, '', currentRow.rowMeta.ltarState || {}, args)
      if (savedRow) {
        currentRow.rowMeta.changed = false
      } else {
        if (args.keepNewRecords) {
          if (beforeSave.rowMeta.new && Object.keys(beforeSave.row).length) {
            temporaryNewRowStore.value.push(beforeSave)
          }
        }
      }
      continue
    }

    /** if existing row check updated cell and invoke update method */
    if (currentRow.rowMeta?.changed) {
      currentRow.rowMeta.changed = false
      for (const field of (args.metaValue || meta.value)?.columns ?? []) {
        // `url` would be enriched in attachment during listing
        // hence it would consider as a change while it is not necessary to update
        if (isVirtualCol(field) || field.uidt === UITypes.Attachment) continue
        if (field.title! in currentRow.row && currentRow.row[field.title!] !== currentRow.oldRow[field.title!]) {
          await updateOrSaveRow?.(currentRow, field.title!, {}, args)
        }
      }
    }
  }
}

const editOrAddProviderRef = ref()

const onVisibilityChange = () => {
  addColumnDropdown.value = editOrAddProviderRef.value?.shouldKeepModalOpen()
}

const COL_VIRTUAL_MARGIN = 5
const ROW_VIRTUAL_MARGIN = 10

const colSlice = ref({
  start: 0,
  end: 0,
})

const lastScrollTop = ref()
const lastScrollLeft = ref()
const lastTotalRows = ref()
const lastTotalFields = ref()

// Store the previous results for binary search to avoid redundant calculations
let prevScrollLeft = -1
let prevScrollWidth = -1
let lastRenderStart = -1
let lastRenderEnd = -1

// Optimized binary search to determine the visible column range
const binarySearchForStart = (scrollLeft: number, clientWidth: number) => {
  if (prevScrollLeft === scrollLeft && prevScrollWidth === clientWidth) {
    // Return cached results if the scroll position and grid width haven't changed
    return { renderStart: lastRenderStart, renderEnd: lastRenderEnd }
  }

  let renderStart = 0
  let startRange = 0
  let endRange = colPositions.value.length - 1

  // Perform binary search to find the starting column
  while (startRange <= endRange) {
    const middle = Math.floor((startRange + endRange) / 2)
    if (colPositions.value[middle] <= scrollLeft && colPositions.value[middle + 1] > scrollLeft) {
      renderStart = middle
      break
    }
    if (colPositions.value[middle] < scrollLeft) {
      startRange = middle + 1
    } else {
      endRange = middle - 1
    }
  }

  // Find the ending column using a simple linear scan starting from renderStart
  let renderEnd = colPositions.value.findIndex((pos) => pos > clientWidth + scrollLeft)
  renderEnd = renderEnd === -1 ? colPositions.value.length : renderEnd

  // Cache the results
  prevScrollLeft = scrollLeft
  prevScrollWidth = clientWidth
  lastRenderStart = renderStart
  lastRenderEnd = renderEnd

  return { renderStart, renderEnd }
}

// Function to update slices only if there's a significant change
const updateSliceIfNeeded = (newStart, newEnd, slice) => {
  if (slice.start !== newStart || slice.end !== newEnd) {
    Object.assign(slice, {
      start: newStart,
      end: newEnd,
    })

    return true // Return true if an update occurred
  }
  return false
}

// Optimized calculateSlices function
const calculateSlices = () => {
  // Skip calculation if the grid wrapper is not rendered yet
  if (!gridWrapper.value) {
    Object.assign(colSlice.value, {
      start: 0,
      end: 0,
    })

    // Retry calculation after a short delay
    setTimeout(calculateSlices, 50)
    return
  }

  // Avoid recalculating if only vertical scrolling occurred and no major change
  if (
    lastScrollLeft.value &&
    lastScrollLeft.value === scrollLeft.value &&
    Math.abs(lastScrollTop.value - scrollTop.value) < 32 * (ROW_VIRTUAL_MARGIN - 2) &&
    lastTotalRows.value === totalRows.value &&
    lastTotalFields.value === fields.value.length
  ) {
    return
  }

  // Cache the current scroll positions
  lastScrollLeft.value = scrollLeft.value
  lastScrollTop.value = scrollTop.value
  lastTotalFields.value = fields.value.length

  // Determine visible column range using binary search
  const { renderStart, renderEnd } = binarySearchForStart(scrollLeft.value, gridWrapper.value.clientWidth)

  // Add virtual margins to the calculated ranges
  const colStart = Math.max(0, renderStart - COL_VIRTUAL_MARGIN)
  const colEnd = Math.min(fields.value.length, renderEnd + COL_VIRTUAL_MARGIN)

  // Update column slice if needed
  updateSliceIfNeeded(colStart, colEnd, colSlice.value)

  // Determine visible row range based on the current scroll position
  const startIndex = Math.max(0, Math.floor(scrollTop.value / rowHeight.value))
  const visibleCount = Math.ceil(gridWrapper.value.clientHeight / rowHeight.value)
  const endIndex = Math.min(startIndex + visibleCount, totalRows.value)

  // Add virtual margins to the row range
  const newStart = Math.max(0, startIndex - ROW_VIRTUAL_MARGIN)
  const newEnd = Math.min(totalRows.value, Math.max(endIndex + ROW_VIRTUAL_MARGIN, newStart + 50))

  // Update row slice if needed
  if (
    rowSlice.start < 10 || // Ensure we initialize the slice
    Math.abs(newStart - rowSlice.start) >= ROW_VIRTUAL_MARGIN / 2 ||
    Math.abs(newEnd - rowSlice.end) >= ROW_VIRTUAL_MARGIN / 2 ||
    lastTotalRows.value !== totalRows.value
  ) {
    rowSlice.start = newStart
    rowSlice.end = newEnd

    updateVisibleRows(true) // Trigger visible row updates
    lastTotalRows.value = totalRows.value
  }
}

let timer1: any
let timer2: any

// Todo: we can remove this after testing
const _calculateSlicesOld = () => {
  if (timer1) {
    clearTimeout(timer1)
  }

  if (timer2) {
    clearTimeout(timer2)
  }

  // if the grid is not rendered yet
  if (!gridWrapper.value) {
    Object.assign(colSlice.value, {
      start: 0,
      end: 0,
    })

    // try again until the grid is rendered
    timer1 = setTimeout(calculateSlices, 50)
    return
  }

  // skip calculation if scrolling only vertical & scroll is smaller than (ROW_VIRTUAL_MARGIN - 2) x smallest row height
  if (
    lastScrollLeft.value &&
    lastScrollLeft.value === scrollLeft.value &&
    Math.abs(lastScrollTop.value - scrollTop.value) < 32 * (ROW_VIRTUAL_MARGIN - 2) &&
    lastTotalRows.value === totalRows.value
  ) {
    return
  }

  lastScrollLeft.value = scrollLeft.value
  lastScrollTop.value = scrollTop.value

  let renderStart = 0

  // use binary search to find the start and end columns
  let startRange = 0
  let endRange = colPositions.value.length - 1

  while (startRange <= endRange) {
    const middle = Math.floor((startRange + endRange) / 2)

    if (colPositions.value[middle] <= scrollLeft.value && colPositions.value[middle + 1] > scrollLeft.value) {
      renderStart = middle
      break
    }

    if (colPositions.value[middle] < scrollLeft.value) {
      startRange = middle + 1
    } else {
      endRange = middle - 1
    }
  }

  let renderEnd = 0
  let renderEndFound = false

  for (let i = renderStart; i < colPositions.value.length; i++) {
    if (colPositions.value[i] > gridWrapper.value.clientWidth + scrollLeft.value) {
      renderEnd = i
      renderEndFound = true
      break
    }
  }

  const colStart = Math.max(0, renderStart - COL_VIRTUAL_MARGIN)
  const colEnd = renderEndFound ? Math.min(fields.value.length, renderEnd + COL_VIRTUAL_MARGIN) : fields.value.length

  if (colSlice.value.start !== colStart || colSlice.value.end !== colEnd) {
    colSlice.value = {
      start: colStart,
      end: colEnd,
    }
  }

  if (gridWrapper.value.clientWidth === 0) {
    timer2 = setTimeout(calculateSlices, 50)
  }

  const startIndex = Math.max(0, Math.floor(scrollTop.value / rowHeight.value))
  const visibleCount = Math.ceil(gridWrapper.value.clientHeight / rowHeight.value)
  const endIndex = Math.min(startIndex + visibleCount, totalRows.value)

  const newStart = Math.max(0, startIndex - ROW_VIRTUAL_MARGIN)
  const newEnd = Math.min(totalRows.value, Math.max(endIndex + ROW_VIRTUAL_MARGIN, newStart + 50))

  if (
    rowSlice.start < 10 ||
    Math.abs(newStart - rowSlice.start) >= ROW_VIRTUAL_MARGIN / 2 ||
    Math.abs(newEnd - rowSlice.end) >= ROW_VIRTUAL_MARGIN / 2 ||
    lastTotalRows.value !== totalRows.value
  ) {
    rowSlice.start = newStart
    rowSlice.end = newEnd

    updateVisibleRows(true)
    lastTotalRows.value = totalRows.value
  }
}

const visibleFields = computed(() => {
  // return data as { field, index } to keep track of the index
  const vFields = fields.value.slice(colSlice.value.start, colSlice.value.end)
  return vFields.map((field, index) => ({ field, index: index + colSlice.value.start })).filter((f) => f.index !== 0)
})

const placeholderStartFields = computed(() => {
  const result = {
    length: colSlice.value.start > 0 ? colSlice.value.start - 1 : 0,
    width: 0,
  }
  result.width = result.length ? colPositions.value[colSlice.value.start]! - colPositions.value[1]! : 0

  return result
})

const placeholderEndFields = computed(() => {
  const result = {
    length: colSlice.value.end < fields.value.length - 1 ? fields.value.length - colSlice.value.end : 0,
    width: 0,
  }
  result.width = result.length ? colPositions.value[fields.value.length]! - colPositions.value[colSlice.value.end]! : 0

  return result
})

const totalRenderedColLength = computed(() => {
  // number col + display col = 2
  return 2 + visibleFields.value.length + placeholderStartFields.value.length + placeholderEndFields.value.length
})

// Fill Handle
const fillHandleTop = ref()
const fillHandleLeft = ref()

function refreshFillHandle() {
  const rowIndex = isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row
  const colIndex = isNaN(selectedRange.end.col) ? activeCell.col : selectedRange.end.col
  if (rowIndex !== null && colIndex !== null) {
    if (!gridWrapper.value || !gridWrapper.value) return

    // 32 for the header
    fillHandleTop.value = (rowIndex + 1) * rowHeight.value + 32
    // 80 for the row number column
    fillHandleLeft.value =
      80 +
      colPositions.value[colIndex + 1] +
      (colIndex === 0 ? Math.max(0, gridWrapper.value.scrollLeft - gridWrapper.value.offsetLeft) : 0)
  }
}

const selectedReadonly = computed(
  () =>
    // if all the selected columns are not readonly
    (selectedRange.isEmpty() && activeCell.col && colMeta.value[activeCell.col].isReadonly) ||
    (!selectedRange.isEmpty() &&
      Array.from({ length: selectedRange.end.col - selectedRange.start.col + 1 }).every(
        (_, i) => colMeta.value[selectedRange.start.col + i].isReadonly,
      )),
)

const showFillHandle = computed(
  () =>
    !isDataReadOnly.value &&
    !readOnly.value &&
    !editEnabled.value &&
    (!selectedRange.isEmpty() || (activeCell.row !== null && activeCell.col !== null)) &&
    !cachedRows.value.get((isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row) ?? -1)?.rowMeta?.new &&
    activeCell.col !== null &&
    fields.value[activeCell.col] &&
    totalRows.value &&
    !selectedReadonly.value,
)

watch(
  [() => selectedRange.end.row, () => selectedRange.end.col, () => activeCell.row, () => activeCell.col],
  ([sr, sc, ar, ac], [osr, osc, oar, oac]) => {
    if (sr !== osr || sc !== osc || ar !== oar || ac !== oac) {
      refreshFillHandle()
    }
  },
)

const handleProgress = (payload: any) => {
  switch (payload.type) {
    case 'table':
      tableState.viewProgress = {
        progress: payload.data.progress,
        message: payload.data.message,
      }
      break

    case 'row':
      tableState.rowProgress.set(payload.data.rowId, {
        progress: payload.data.progress,
        message: payload.data.message,
      })
      break

    case 'cell': {
      if (!tableState.cellProgress.has(payload.data.rowId)) {
        tableState.cellProgress.set(payload.data.rowId, new Map())
      }
      const rowCells = tableState.cellProgress.get(payload.data.rowId)!
      rowCells.set(payload.data.cellId, {
        progress: payload.data.progress,
        message: payload.data.message,
        icon: payload.data?.icon,
      })
      break
    }
  }
}

const resetProgress = (payload: { type: 'table' | 'row' | 'cell'; data: { rowId?: string; cellId?: string } }) => {
  switch (payload.type) {
    case 'table':
      tableState.viewProgress = null
      tableState.cellProgress = new Map()
      tableState.rowProgress = new Map()
      break

    case 'row':
      if (payload.data.rowId) {
        tableState.rowProgress.delete(payload.data.rowId)
        tableState.rowProgress.set(payload.data.rowId, null)
      }
      break

    case 'cell':
      if (payload.data.rowId && payload.data.cellId) {
        const rowCells = tableState.cellProgress.get(payload.data.rowId)
        if (rowCells) {
          rowCells.delete(payload.data.cellId)
          if (rowCells.size === 0) {
            tableState.cellProgress.delete(payload.data.rowId)
          } else {
            tableState.cellProgress.set(payload.data.rowId, rowCells)
          }
        }
      }
      break
  }
}

eventBus.on(async (event, payload) => {
  if (event === SmartsheetStoreEvents.FIELD_ADD) {
    columnOrder.value = payload
    addColumnDropdown.value = true
  }
  if (event === SmartsheetStoreEvents.CLEAR_NEW_ROW) {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null

    removeRowIfNew?.(payload)
  }
})

watch(activeCell, (activeCell) => {
  const row = activeCell.row !== null ? cachedRows.value.get(activeCell.row)?.row : undefined
  const col = row && activeCell.col !== null ? fields.value[activeCell.col] : undefined
  const val = row && col ? row[col.title as string] : undefined

  const rowId = extractPkFromRow(row!, meta.value?.columns as ColumnType[])
  const viewId = view.value?.id

  eventBus.emit(SmartsheetStoreEvents.CELL_SELECTED, { rowId, colId: col?.id, val, viewId })
})

const reloadViewDataHookHandler = async (param) => {
  if (param?.fieldAdd) {
    gridWrapper.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  await saveOrUpdateRecords({
    keepNewRecords: true,
  })

  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)

  await syncCount()

  calculateSlices()

  await Promise.all([loadViewAggregate(), updateVisibleRows()])

  temporaryNewRowStore.value.forEach((row, index) => {
    row.rowMeta.rowIndex = totalRows.value + index
    cachedRows.value.set(totalRows.value + index, row)
  })
}

let requestAnimationFrameId: null | number = null
const { eventBus: scriptEventBus } = useScriptExecutor()

scriptEventBus.on(async (event, payload) => {
  if (event === SmartsheetScriptActions.UPDATE_PROGRESS) {
    handleProgress(payload)
  }
  if (event === SmartsheetScriptActions.RESET_PROGRESS) {
    resetProgress(payload)
  }
  if (event === SmartsheetScriptActions.RELOAD_VIEW) {
    await reloadViewDataHookHandler()
  }
})

useScroll(gridWrapper, {
  onScroll: (e) => {
    // Cancel the previous animation frame if it exists
    if (requestAnimationFrameId) {
      cancelAnimationFrame(requestAnimationFrameId)
    }

    // Request a new animation frame for optimized execution
    requestAnimationFrameId = requestAnimationFrame(() => {
      scrollLeft.value = e.target?.scrollLeft
      scrollTop.value = e.target?.scrollTop

      // Execute slicing calculations and handle updates
      calculateSlices()
      refreshFillHandle()

      // Clear the frame ID after execution
      requestAnimationFrameId = null
    })
  },
  throttle: 100, // Throttle value for smoother scrolling
  behavior: 'smooth',
})

useEventListener(document, 'mousedown', (e) => {
  if (e.offsetX > (e.target as HTMLElement)?.clientWidth || e.offsetY > (e.target as HTMLElement)?.clientHeight) {
    scrolling.value = true
  }

  if ((e.target as HTMLElement).closest('.nc-grid-cell:not(.caption)')) {
    isGridCellMouseDown.value = true
  }
})

useEventListener(document, 'mouseup', () => {
  isGridCellMouseDown.value = false
  // wait for click event to finish before setting scrolling to false
  setTimeout(() => {
    scrolling.value = false
  }, 100)
})

useEventListener(document, 'keyup', async (e: KeyboardEvent) => {
  const isRichModalOpen = isExpandedCellInputExist()

  if (e.key === 'Alt' && !isRichModalOpen) {
    disableUrlOverlay.value = false
  }

  const activeDropdownEl = document.querySelector('.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active')

  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  if (
    isKeyDown.value &&
    !isRichModalOpen &&
    !activeDropdownEl &&
    !isDrawerOrModalExist() &&
    !cmdOrCtrl &&
    !e.shiftKey &&
    !e.altKey
  ) {
    if (
      (e.key === 'Tab' && activeCell.row === totalRows.value - 1 && activeCell.col === fields.value?.length - 1) ||
      (e.key === 'ArrowDown' && activeCell.row === totalRows.value - 1 && isAddingEmptyRowAllowed.value)
    ) {
      addEmptyRow()
      isKeyDown.value = false
    }
  }
})

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 78: {
        // ALT + N
        if (isAddingEmptyRowAllowed.value) {
          addEmptyRow()
        }
        break
      }
    }
  }
})

const triggerReload = () => {
  calculateSlices()
  refreshFillHandle()
  updateVisibleRows()
}

onBeforeUnmount(async () => {
  /** save/update records before unmounting the component */
  const viewMetaValue = view.value
  const dataValue = cachedRows.value.values()
  if (viewMetaValue) {
    getMeta(viewMetaValue.fk_model_id, false, true).then((res) => {
      const metaValue = res
      if (!metaValue) return
      saveOrUpdateRecords({
        metaValue,
        viewMetaValue,
        data: dataValue,
      })
    })
  }

  // reset hooks
  reloadViewDataHook?.off(reloadViewDataHookHandler)
  openNewRecordFormHook?.off(openNewRecordHandler)
  reloadVisibleDataHook?.off(triggerReload)
})

openNewRecordFormHook?.on(openNewRecordHandler)
reloadViewDataHook?.on(reloadViewDataHookHandler)

reloadVisibleDataHook?.on(triggerReload)

watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuClosing.value = true
    contextMenuTarget.value = null
  } else {
    contextMenuClosing.value = false
  }
})

watch(
  view,
  async (next, old) => {
    try {
      if (next && next.id !== old?.id && (next.fk_model_id === route.params.viewId || isPublicView.value)) {
        switchingTab.value = true
        // whenever tab changes or view changes save any unsaved data
        if (old?.id) {
          const oldMeta = await getMeta(old.fk_model_id!, false, true)
          if (oldMeta) {
            await saveOrUpdateRecords({
              viewMetaValue: old,
              metaValue: oldMeta as TableType,
              data: cachedRows.value.entries(),
            })
          }
        }
        try {
          // Sync the count
          await syncCount()
          // Calculate the slices and load the view aggregate and data
          calculateSlices()

          if (rowSlice.end === 0) {
            rowSlice.end = Math.min(100, totalRows.value)
          }
          await Promise.allSettled([loadViewAggregate(), updateVisibleRows()])
        } catch (e) {
          if (!axios.isCancel(e)) {
            console.log(e)
            message.error(t('msg.errorLoadingData'))
          }
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      switchingTab.value = false
    }
  },
  {
    immediate: true,
  },
)

watch([() => fields.value.length, () => cachedRows.value.size], () => {
  calculateSlices()
  refreshFillHandle()
  updateVisibleRows()
})

watch(rowHeight, () => {
  calculateSlices()
})

provide(CellUrlDisableOverlayInj, disableUrlOverlay)

defineExpose({
  scrollToRow,
  openColumnCreate,
})

const expandAndLooseFocus = (row: Row, col: Record<string, any>) => {
  if (expandForm) {
    expandForm(row, col)
  }
  // remove focus from the cell
  activeCell.row = null
  activeCell.col = null
  selectedRange.clear()
}

const handleCellClick = (event: MouseEvent, row: number, col: number) => {
  const rowData = cachedRows.value.get(row)

  if (activeCell.row !== row) {
    onActiveCellChanged()
  }

  if (isMobileMode.value) {
    return expandAndLooseFocus(rowData, fields.value[col])
  }

  _handleCellClick(event, row, col)
}

function scrollToAddNewColumnHeader(behavior: ScrollOptions['behavior']) {
  gridWrapper.value?.scrollTo({
    top: gridWrapper.value.scrollTop,
    left: gridWrapper.value.scrollWidth,
    behavior,
  })
}

const maxGridWidth = computed(() => {
  return colPositions.value[colPositions.value.length - 1] + 80
})

const maxGridHeight = computed(() => {
  return totalRows.value * rowHeight.value
})

const { width, height } = useWindowSize()

watch(
  [width, height],
  () => {
    calculateSlices()
  },
  {
    immediate: true,
  },
)

const callAddNewRow = (context: { row: number; col: number }, direction: 'above' | 'below') => {
  const row = cachedRows.value.get(direction === 'above' ? context.row : context.row + 1)

  if (row) {
    const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
    addEmptyRow(context.row + (direction === 'above' ? 0 : 1), false, rowId)
  } else {
    addEmptyRow()
  }
}

const onRecordDragStart = (row: Row) => {
  activeCell.row = null
  activeCell.col = null

  row.rowMeta.isDragging = true

  cachedRows.value.set(row.rowMeta.rowIndex, row)
}

const {
  startDragging: _startDragging,
  isDragging,
  draggingRecord,
  targetTop,
} = useRowDragging({
  updateRecordOrder,
  onDragStart: onRecordDragStart,
  gridWrapper,
  virtualMargin: ROW_VIRTUAL_MARGIN,
  rowHeight,
  totalRows,
  rowSlice,
  cachedRows,
})

const startDragging = (row: Row, event: MouseEvent) => {
  if (isPublicView.value) return
  row.rowMeta.isDragging = true
  cachedRows.value.set(row.rowMeta.rowIndex!, row)
  _startDragging(row, event)
}

const toggleRowSelection = (row: number) => {
  if (vSelectedAllRecords.value) return
  const data = cachedRows.value.get(row)

  if (!data) return
  data.rowMeta.selected = !data.rowMeta?.selected
  cachedRows.value.set(row, data)
}

watch(vSelectedAllRecords, (selectedAll) => {
  if (!selectedAll) {
    for (const [row, data] of cachedRows.value.entries()) {
      if (data.rowMeta?.selected) {
        data.rowMeta.selected = false
        cachedRows.value.set(row, data)
      }
    }
  }
})

const cellAlignClass = computed(() => {
  if (!props.rowHeightEnum || props.rowHeightEnum === 1) {
    return 'align-middle'
  }
  return 'align-top'
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div data-testid="drag-icon-placeholder" class="absolute w-1 h-1 pointer-events-none opacity-0"></div>
    <div
      ref="dragColPlaceholderDomRef"
      :class="{
        'hidden w-0 !h-0 left-0 !max-h-0 !max-w-0': !draggedCol,
      }"
      class="absolute flex items-center z-40 top-0 h-full bg-gray-50 pointer-events-none opacity-60"
    >
      <div
        v-if="draggedCol"
        :style="{
        'min-width': gridViewCols[draggedCol.id!]?.width || '200px',
        'max-width': gridViewCols[draggedCol.id!]?.width || '200px',
        'width': gridViewCols[draggedCol.id!]?.width || '200px',
      }"
        class="border-r-1 border-l-1 border-gray-200 h-full"
      ></div>
    </div>
    <div
      v-if="isBulkOperationInProgress || tableState.viewProgress"
      class="absolute h-full flex items-center justify-center z-70 w-full inset-0 bg-white/50"
    >
      <div class="flex gap-2 items-center">
        {{ tableState.viewProgress?.progress }}
        {{ tableState.viewProgress?.message }}
      </div>
      <GeneralLoader size="regular" />
    </div>

    <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 relative !overflow-auto">
      <NcDropdown
        v-model:visible="contextMenu"
        :disabled="contextMenuTarget === null && !selectedRows.length && !vSelectedAllRecords"
        :trigger="isSqlView ? [] : ['contextmenu']"
        overlay-class-name="nc-dropdown-grid-context-menu"
      >
        <div>
          <table
            :class="{
              mobile: isMobileMode,
              desktop: !isMobileMode,
            }"
            class="nc-grid backgroundColorDefault !h-auto bg-white sticky top-0 z-5 bg-white"
          >
            <thead>
              <tr v-if="isViewColumnsLoading">
                <td
                  v-for="(_col, colIndex) of dummyColumnDataForLoading"
                  :key="colIndex"
                  class="!bg-gray-50 h-full border-b-1 border-r-1"
                  :class="{ 'min-w-45': colIndex !== 0, 'min-w-16': colIndex === 0 }"
                >
                  <a-skeleton
                    :active="true"
                    :title="true"
                    :paragraph="false"
                    class="ml-2 -mt-2"
                    :class="{
                      'max-w-32': colIndex !== 0,
                      'max-w-5 !ml-3.5': colIndex === 0,
                    }"
                  />
                </td>
              </tr>
              <tr v-show="!isViewColumnsLoading" class="nc-grid-header transform">
                <th ref="numColHeader" class="w-[80px] min-w-[80px]" data-testid="grid-id-column">
                  <div
                    v-if="!readOnly"
                    data-testid="nc-check-all"
                    class="flex items-center pl-2 pr-1 w-full h-full justify-center"
                  >
                    <div class="nc-no-label text-gray-500" :class="{ hidden: vSelectedAllRecords }">#</div>
                    <div
                      :class="{
                        hidden: !vSelectedAllRecords,
                        flex: vSelectedAllRecords,
                      }"
                      class="nc-check-all w-full items-center"
                    >
                      <NcCheckbox v-model:checked="vSelectedAllRecords" />

                      <span class="flex-1" />
                    </div>
                  </div>
                  <template v-else>
                    <div class="w-full h-full text-gray-500 flex pl-2 pr-1 items-center" data-testid="nc-check-all">#</div>
                  </template>
                </th>
                <th
                  v-if="fields?.[0]?.id"
                  ref="primaryColHeader"
                  v-xc-ver-resize
                  v-bind="
                    isPlaywright
                      ? {
                          'data-col': fields[0].id,
                          'data-title': fields[0].title,
                        }
                      : {}
                  "
                  :style="{
                    'min-width': gridViewCols[fields[0].id]?.width || '180px',
                    'max-width': gridViewCols[fields[0].id]?.width || '180px',
                    'width': gridViewCols[fields[0].id]?.width || '180px',
                  }"
                  class="nc-grid-column-header"
                  :class="{
                    '!border-r-blue-400 !border-r-3': toBeDroppedColId === fields[0].id,
                  }"
                  @xcstartresizing="onXcStartResizing(fields[0].id, $event)"
                  @xcresize="onresize(fields[0].id, $event)"
                  @xcresizing="onXcResizing(fields[0].id, $event)"
                >
                  <div
                    class="w-full h-full flex items-center text-gray-500 pl-2 pr-1"
                    draggable="false"
                    @dragstart.stop="onDragStart(fields[0].id!, $event)"
                    @drag.stop="onDrag($event)"
                    @dragend.stop="onDragEnd($event)"
                  >
                    <LazySmartsheetHeaderVirtualCell
                      v-if="fields[0] && colMeta[0].isVirtualCol"
                      :column="fields[0]"
                      :hide-menu="readOnly || !!isMobileMode"
                    />
                    <LazySmartsheetHeaderCell v-else :column="fields[0]" :hide-menu="readOnly || !!isMobileMode" />
                  </div>
                </th>
                <th
                  v-if="placeholderStartFields.length"
                  :colspan="placeholderStartFields.length"
                  :style="{
                    minWidth: `${placeholderStartFields.width}px`,
                    maxWidth: `${placeholderStartFields.width}px`,
                    width: `${placeholderStartFields.width}px`,
                  }"
                  class="nc-grid-column-header"
                ></th>
                <th
                  v-for="{ field: col, index } in visibleFields"
                  :key="col.id"
                  v-bind="
                    isPlaywright
                      ? {
                          'data-col': col.id,
                          'data-title': col.title,
                        }
                      : {}
                  "
                  v-xc-ver-resize
                  :style="{
                    'min-width': gridViewCols[col.id]?.width || '180px',
                    'max-width': gridViewCols[col.id]?.width || '180px',
                    'width': gridViewCols[col.id]?.width || '180px',
                  }"
                  class="nc-grid-column-header"
                  :class="{
                    '!border-r-blue-400 !border-r-3': toBeDroppedColId === col.id,
                  }"
                  @xcstartresizing="onXcStartResizing(col.id, $event)"
                  @xcresize="onresize(col.id, $event)"
                  @xcresizing="onXcResizing(col.id, $event)"
                >
                  <div
                    class="w-full h-full flex items-center text-gray-500 pl-2 pr-1"
                    :draggable="isMobileMode || index === 0 || readOnly || !hasEditPermission ? 'false' : 'true'"
                    @dragstart.stop="onDragStart(col.id!, $event)"
                    @drag.stop="onDrag($event)"
                    @dragend.stop="onDragEnd($event)"
                  >
                    <LazySmartsheetHeaderVirtualCell
                      v-if="colMeta[index].isVirtualCol"
                      :column="col"
                      :hide-menu="readOnly || !!isMobileMode"
                    />
                    <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="readOnly || !!isMobileMode" />
                  </div>
                </th>
                <th
                  v-if="placeholderEndFields.length"
                  :colspan="placeholderEndFields.length"
                  :style="{
                    minWidth: `${placeholderEndFields.width}px`,
                    maxWidth: `${placeholderEndFields.width}px`,
                    width: `${placeholderEndFields.width}px`,
                  }"
                  class="nc-grid-column-header"
                ></th>
                <th
                  v-if="isAddingColumnAllowed"
                  v-e="['c:column:add']"
                  class="cursor-pointer !border-0 relative !xs:hidden"
                  :style="{
                    borderWidth: '0px !important',
                  }"
                  @click.stop="addColumnDropdown = true"
                >
                  <div class="absolute top-0 left-0 h-8 border-b-1 border-r-1 border-gray-200 nc-grid-add-edit-column group">
                    <a-dropdown
                      v-model:visible="addColumnDropdown"
                      :trigger="['click']"
                      overlay-class-name="nc-dropdown-add-column"
                      @visible-change="onVisibilityChange"
                    >
                      <div class="h-full w-[60px] flex items-center justify-center">
                        <component :is="iconMap.plus" class="text-base nc-column-add text-gray-500 !group-hover:text-black" />
                      </div>
                      <template #overlay>
                        <div class="nc-edit-or-add-provider-wrapper">
                          <LazySmartsheetColumnEditOrAddProvider
                            v-if="addColumnDropdown"
                            ref="editOrAddProviderRef"
                            :preload="preloadColumn"
                            :column-position="columnOrder"
                            :class="{ hidden: isJsonExpand }"
                            @submit="closeAddColumnDropdownMenu(true)"
                            @cancel="closeAddColumnDropdownMenu()"
                            @click.stop
                            @keydown.stop
                            @mounted="preloadColumn = undefined"
                          />
                        </div>
                      </template>
                    </a-dropdown>
                  </div>
                </th>
                <th
                  class="!border-0 relative !xs:hidden"
                  :style="{
                    borderWidth: '0px !important',
                  }"
                >
                  <div
                    class="absolute top-0 w-45"
                    :class="{
                      'left-[60px]': isAddingColumnAllowed,
                      'left-0': !isAddingColumnAllowed,
                    }"
                  >
                    &nbsp;
                  </div>
                </th>
              </tr>
            </thead>
          </table>

          <div v-show="isDragging" class="dragging-record" :style="{ width: `${width}px`, top: `${targetTop}px` }"></div>

          <div
            class="table-overlay"
            :style="{
              height: isBulkOperationInProgress ? '100%' : `${maxGridHeight + 256}px`,
              width: `${maxGridWidth}px`,
            }"
          >
            <table
              class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white relative"
              :class="{
                'mobile': isMobileMode,
                'desktop': !isMobileMode,
                'w-full': visibleRows?.length === 0,
              }"
              @contextmenu="showContextMenu"
            >
              <tbody
                ref="tableBodyEl"
                class="xc-row-table"
                :style="{
                  transform: `translateY(${topOffset}px)`,
                }"
              >
                <LazySmartsheetGridPlaceholderRow
                  v-if="placeholderStartRows.length"
                  :row-count="placeholderStartRows.length"
                  :row-height="placeholderStartRows.rowHeight"
                  :total-row-height="placeholderStartRows.totalRowHeight"
                  :col-count="totalRenderedColLength"
                />
                <LazySmartsheetRow
                  v-for="(row, index) in visibleRows"
                  :key="`${row.rowMeta.rowIndex}-${row.rowMeta?.new}`"
                  :row="row"
                >
                  <template #default="{ state }">
                    <div
                      v-if="row.rowMeta?.isValidationFailed"
                      :style="{
                        top: `${(index + 1 + placeholderStartRows.length) * rowHeight - 6}px`,
                        zIndex: 100001,
                      }"
                      class="absolute z-30 left-0 w-full flex"
                    >
                      <div
                        class="sticky left-0 flex items-center gap-2 transform bg-yellow-500 px-2 py-1 rounded-br-md font-semibold text-xs text-gray-800"
                      >
                        Row filtered

                        <NcTooltip>
                          <template #title>
                            This record will be hidden as it does not match the filters applied to this view.
                          </template>

                          <GeneralIcon icon="info" class="w-4 h-4 text-gray-800" />
                        </NcTooltip>
                      </div>
                    </div>
                    <div
                      v-if="row.rowMeta?.isRowOrderUpdated"
                      :style="{
                        top: `${(index + 1 + placeholderStartRows.length) * rowHeight - 6}px`,
                        zIndex: 100000,
                      }"
                      class="absolute transform z-30 left-0 w-full flex"
                    >
                      <div
                        class="sticky left-0 flex items-center gap-2 transform bg-yellow-500 px-2 py-1 rounded-br-md font-semibold text-xs text-gray-800"
                      >
                        Row moved

                        <NcTooltip>
                          <template #title> This record will move to a new position when you click outside of it. </template>

                          <GeneralIcon icon="info" class="w-4 h-4 text-gray-800" />
                        </NcTooltip>
                      </div>
                    </div>
                    <tr
                      class="nc-grid-row transition transition-all duration-500 opacity-100 !xs:h-14"
                      :style="{
                        height: `${rowHeight}px`,
                      }"
                      :data-testid="`grid-row-${row.rowMeta.rowIndex}`"
                      :class="{
                        'active-row':
                          activeCell.row === row.rowMeta.rowIndex || selectedRange._start?.row === row.rowMeta.rowIndex,
                        'mouse-down': isGridCellMouseDown || isFillMode,
                        'selected-row': row.rowMeta.selected || vSelectedAllRecords,
                        'invalid-row': row.rowMeta?.isValidationFailed || row.rowMeta?.isRowOrderUpdated,
                        'is-dragging': row.rowMeta?.rowIndex === draggingRecord?.rowMeta?.rowIndex,
                      }"
                    >
                      <td
                        class="caption nc-grid-cell w-[80px] min-w-[80px]"
                        :data-testid="`cell-Id-${row.rowMeta.rowIndex}`"
                        @contextmenu="contextMenuTarget = null"
                      >
                        <div class="w-full flex items-center h-full px-1 gap-0.5">
                          <div
                            class="nc-row-no min-w-4 h-4 text-xs flex items-center justify-center text-gray-500"
                            :class="{ toggle: !readOnly, hidden: row.rowMeta?.selected || vSelectedAllRecords }"
                          >
                            {{ row.rowMeta.rowIndex + 1 }}
                          </div>

                          <div
                            v-if="!selectedRows.length && isOrderColumnExists && !isRowReorderDisabled && !vSelectedAllRecords"
                            :class="{ toggle: !readOnly }"
                            class="nc-drag-handle hidden"
                          >
                            <NcButton size="xxsmall" type="text" @mousedown="startDragging(row, $event)">
                              <GeneralIcon class="text-nc-content-gray hover:text-nc-content-brand" icon="ncDrag" />
                            </NcButton>
                          </div>
                          <div
                            v-if="!readOnly"
                            :class="{
                              hidden: !row.rowMeta?.selected && !vSelectedAllRecords,
                              flex: row.rowMeta?.selected || vSelectedAllRecords,
                            }"
                            class="nc-row-expand-and-checkbox"
                          >
                            <NcCheckbox
                              :checked="row.rowMeta.selected || vSelectedAllRecords"
                              :disabled="(!row.rowMeta.selected && selectedRows.length >= 100) || vSelectedAllRecords"
                              class="!w-4 !h-4"
                              @change="toggleRowSelection(row.rowMeta.rowIndex)"
                            />
                          </div>
                          <div :data-testid="`nc-expand-${row.rowMeta.rowIndex}`">
                            <a-spin
                              v-if="row.rowMeta?.saving || row.rowMeta?.isLoading"
                              class="hidden nc-row-spinner items-center"
                              :data-testid="`row-save-spinner-${row.rowMeta.rowIndex}`"
                            />

                            <template v-else>
                              <span
                                v-if="row.rowMeta?.commentCount && expandForm"
                                v-e="['c:expanded-form:open']"
                                :class="{ 'nc-comment': row.rowMeta?.commentCount }"
                                class="px-1 rounded-md rounded-bl-none ml-1 transition-all border-1 border-brand-200 text-xs cursor-pointer font-sembold select-none leading-5 text-brand-500 bg-brand-50"
                                @click="expandAndLooseFocus(row, state)"
                              >
                                {{ row.rowMeta.commentCount }}
                              </span>
                              <div
                                v-else
                                class="cursor-pointer nc-expand flex items-center border-1 border-gray-100 active:ring rounded-md p-1 hover:(bg-white border-nc-border-gray-medium)"
                              >
                                <component
                                  :is="iconMap.maximize"
                                  v-if="expandForm"
                                  v-e="['c:row-expand:open']"
                                  class="select-none transform nc-row-expand opacity-90 w-4 h-4"
                                  @click="expandAndLooseFocus(row, state)"
                                />
                              </div>
                            </template>
                          </div>
                        </div>
                      </td>
                      <SmartsheetTableDataCell
                        v-if="fields[0]"
                        :key="fields[0].id"
                        class="cell relative nc-grid-cell cursor-pointer"
                        :class="{
                          'active': selectRangeMap[`${row.rowMeta.rowIndex}-0`],
                          'active-cell !after:h-[calc(100%-1px)]':
                            (activeCell.row === row.rowMeta.rowIndex && activeCell.col === 0) ||
                            (selectedRange._start?.row === row.rowMeta.rowIndex && selectedRange._start?.col === 0),
                          'nc-required-cell':
                            !row.rowMeta?.isLoading && cellMeta[index]?.[0]?.isColumnRequiredAndNull && !isPublicView,
                          'filling': fillRangeMap[`${row.rowMeta.rowIndex}-0`],
                          'readonly':
                            colMeta[0]?.isReadonly && hasEditPermission && selectRangeMap?.[`${row.rowMeta.rowIndex}-0`],
                          '!border-r-blue-400 !border-r-3': toBeDroppedColId === fields[0].id,
                          [cellAlignClass]: true,
                        }"
                        :style="{
                          'min-width': gridViewCols[fields[0].id]?.width || '180px',
                          'max-width': gridViewCols[fields[0].id]?.width || '180px',
                          'width': gridViewCols[fields[0].id]?.width || '180px',
                        }"
                        :data-testid="`cell-${fields[0].title}-${row.rowMeta.rowIndex}`"
                        v-bind="
                          isPlaywright
                            ? {
                                'data-key': `data-key-${row.rowMeta.rowIndex}-${fields[0].id}`,
                                'data-col': fields[0].id,
                                'data-title': fields[0].title,
                                'data-row-index': row.rowMeta.rowIndex,
                                'data-col-index': 0,
                              }
                            : {}
                        "
                        @mousedown="handleMouseDown($event, row.rowMeta.rowIndex, 0)"
                        @mouseover="handleMouseOver($event, row.rowMeta.rowIndex, 0)"
                        @dblclick="makeEditable(row, fields[0])"
                        @contextmenu="showContextMenu($event, { row: row.rowMeta.rowIndex, col: 0 })"
                        @click="handleCellClick($event, row.rowMeta.rowIndex, 0)"
                      >
                        <template v-if="cellMeta[index][0]?.cellProgress && !switchingTab">
                          <div
                            class="opacity-0.4 gap-2 truncate flex items-center overflow-x-hidden text-sm text-nc-content-gray-muted"
                          >
                            <GeneralIcon
                              v-if="cellMeta[index][0]?.cellProgress?.icon"
                              class="w-4 h-4"
                              :icon="cellMeta[index][0]?.cellProgress?.icon"
                            />
                            {{ cellMeta[index][0]?.cellProgress.message }}
                            <div class="flex-1" />
                            <GeneralSpinner class="w-4 h-4" />
                          </div>
                        </template>
                        <div v-else-if="!switchingTab" class="w-full">
                          <LazySmartsheetVirtualCell
                            v-if="fields[0] && colMeta[0].isVirtualCol && fields[0].title"
                            v-model="row.row[fields[0].title]"
                            :active="activeCell.col === 0 && activeCell.row === row.rowMeta.rowIndex"
                            :column="fields[0]"
                            :row="row"
                            :read-only="!hasEditPermission"
                            @navigate="onNavigate"
                            @save="updateOrSaveRow?.(row, '', state)"
                          />

                          <LazySmartsheetCell
                            v-else-if="fields[0] && fields[0].title"
                            v-model="row.row[fields[0].title]"
                            :column="fields[0]"
                            :edit-enabled="
                              !!hasEditPermission &&
                              !!editEnabled &&
                              activeCell.col === 0 &&
                              activeCell.row === row.rowMeta.rowIndex
                            "
                            :row-index="row.rowMeta.rowIndex"
                            :active="activeCell.col === 0 && activeCell.row === row.rowMeta.rowIndex"
                            :read-only="!hasEditPermission"
                            @update:edit-enabled="editEnabled = $event"
                            @navigate="onNavigate"
                            @cancel="editEnabled = false"
                            @save="updateOrSaveRow?.(row, fields[0].title, state)"
                          />
                        </div>
                      </SmartsheetTableDataCell>
                      <td
                        v-if="placeholderStartFields.length"
                        :colspan="placeholderStartFields.length"
                        :style="{
                          minWidth: `${placeholderStartFields.width}px`,
                          maxWidth: `${placeholderStartFields.width}px`,
                          width: `${placeholderStartFields.width}px`,
                        }"
                        class="nc-grid-cell"
                      ></td>
                      <SmartsheetTableDataCell
                        v-for="{ field: columnObj, index: colIndex } of visibleFields"
                        :key="`cell-${colIndex}-${row.rowMeta.rowIndex}`"
                        class="cell relative nc-grid-cell cursor-pointer"
                        :class="{
                          'active': selectRangeMap[`${row.rowMeta.rowIndex}-${colIndex}`],
                          'active-cell':
                            (activeCell.row === row.rowMeta.rowIndex && activeCell.col === colIndex) ||
                            (selectedRange._start?.row === row.rowMeta.rowIndex && selectedRange._start?.col === colIndex),
                          'nc-required-cell':
                            !row.rowMeta?.isLoading && cellMeta[index][colIndex].isColumnRequiredAndNull && !isPublicView,

                          'filling': fillRangeMap[`${row.rowMeta.rowIndex}-${colIndex}`],
                          'readonly':
                            colMeta[colIndex].isReadonly &&
                            hasEditPermission &&
                            selectRangeMap[`${row.rowMeta.rowIndex}-${colIndex}`],
                          '!border-r-blue-400 !border-r-3': toBeDroppedColId === columnObj.id,
                          [cellAlignClass]: true,
                        }"
                        :style="{
                          'min-width': gridViewCols[columnObj.id]?.width || '180px',
                          'max-width': gridViewCols[columnObj.id]?.width || '180px',
                          'width': gridViewCols[columnObj.id]?.width || '180px',
                        }"
                        :data-testid="`cell-${columnObj.title}-${row.rowMeta.rowIndex}`"
                        v-bind="
                          isPlaywright
                            ? {
                                'data-key': `data-key-${row.rowMeta.rowIndex}-${columnObj.id}`,
                                'data-col': columnObj.id,
                                'data-title': columnObj.title,
                                'data-row-index': row.rowMeta.rowIndex,
                                'data-col-index': 0,
                              }
                            : {}
                        "
                        @mousedown="handleMouseDown($event, row.rowMeta.rowIndex, colIndex)"
                        @mouseover="handleMouseOver($event, row.rowMeta.rowIndex, colIndex)"
                        @click="handleCellClick($event, row.rowMeta.rowIndex, colIndex)"
                        @dblclick="makeEditable(row, columnObj)"
                        @contextmenu="showContextMenu($event, { row: row.rowMeta.rowIndex, col: colIndex })"
                      >
                        <template v-if="cellMeta[index][colIndex]?.cellProgress && !switchingTab">
                          <div
                            class="opacity-0.4 gap-2 truncate flex items-center overflow-x-hidden text-sm text-nc-content-gray-muted"
                          >
                            <GeneralIcon
                              v-if="cellMeta[index][colIndex]?.cellProgress?.icon"
                              class="w-4 h-4"
                              :icon="cellMeta[index][colIndex]?.cellProgress?.icon"
                            />
                            {{ cellMeta[index][colIndex]?.cellProgress.message }}
                            <div class="flex-1" />
                            <GeneralSpinner class="w-4 h-4" />
                          </div>
                        </template>
                        <div v-else-if="!switchingTab" class="w-full">
                          <LazySmartsheetVirtualCell
                            v-if="colMeta[colIndex].isVirtualCol && columnObj.title"
                            v-model="row.row[columnObj.title]"
                            :column="columnObj"
                            :row="row"
                            :active="activeCell.col === colIndex && activeCell.row === row.rowMeta.rowIndex"
                            :read-only="!hasEditPermission"
                            @navigate="onNavigate"
                            @save="updateOrSaveRow?.(row, '', state)"
                          />

                          <LazySmartsheetCell
                            v-else-if="columnObj.title"
                            v-model="row.row[columnObj.title]"
                            :edit-enabled="
                              !!hasEditPermission &&
                              !!editEnabled &&
                              activeCell.col === colIndex &&
                              activeCell.row === row.rowMeta.rowIndex
                            "
                            :active="activeCell.col === colIndex && activeCell.row === row.rowMeta.rowIndex"
                            :read-only="!hasEditPermission"
                            :column="columnObj"
                            :row-index="row.rowMeta.rowIndex"
                            @save="updateOrSaveRow?.(row, columnObj.title, state)"
                            @navigate="onNavigate"
                            @cancel="editEnabled = false"
                          />
                        </div>
                      </SmartsheetTableDataCell>
                      <td
                        v-if="placeholderEndFields.length"
                        :colspan="placeholderEndFields.length"
                        :style="{
                          minWidth: `${placeholderEndFields.width}px`,
                          maxWidth: `${placeholderEndFields.width}px`,
                          width: `${placeholderEndFields.width}px`,
                        }"
                        class="nc-grid-cell"
                      ></td>
                    </tr>
                  </template>
                </LazySmartsheetRow>
                <LazySmartsheetGridPlaceholderRow
                  v-if="placeholderEndRows.length"
                  :row-count="placeholderEndRows.length"
                  :row-height="placeholderEndRows.rowHeight"
                  :total-row-height="placeholderEndRows.totalRowHeight"
                  :col-count="totalRenderedColLength"
                />
                <tr
                  v-if="isAddingEmptyRowAllowed"
                  v-e="['c:row:add:grid-bottom']"
                  class="text-left nc-grid-add-new-cell mb-[80px] transition-all cursor-pointer group relative z-3 xs:hidden"
                  :class="{
                    '!border-r-2 !border-r-gray-100': visibleColLength === 1,
                  }"
                  :style="{
                    height: '32px',
                  }"
                  @click="addEmptyRow()"
                >
                  <td
                    class="nc-grid-add-new-cell-item h-8 border-b-1 border-gray-100 bg-white group-hover:bg-gray-50 absolute left-0 bottom-0 px-2 sticky z-40 w-full flex items-center text-gray-500"
                  >
                    <component
                      :is="iconMap.plus"
                      v-if="!isViewColumnsLoading"
                      class="text-pint-500 text-base ml-2 mt-0 text-gray-600 group-hover:text-black"
                    />
                  </td>
                  <td :colspan="visibleColLength" class="!border-gray-100"></td>
                </tr>
              </tbody>
            </table>

            <div
              v-show="showFillHandle"
              ref="fillHandle"
              class="nc-fill-handle"
              :class="{
                'z-3': !selectedRange.isEmpty() && selectedRange.end.col !== 0,
                'z-4': selectedRange.isEmpty() && activeCell.col !== 0,
                'transition-all !bg-purple-400 !w-[10px] !h-[10px] !mt-[-5px] !ml-[-5px]': isAIFillMode,
              }"
              :style="{
                top: `${fillHandleTop}px`,
                left: `${fillHandleLeft}px`,
                cursor: 'crosshair',
              }"
            />
          </div>
        </div>

        <template #overlay>
          <NcMenu class="!rounded !py-0" variant="small" @click="contextMenu = false">
            <template v-if="!vSelectedAllRecords">
              <NcMenuItem
                v-if="isEeUI && !contextMenuClosing && !contextMenuTarget && !isDataReadOnly && selectedRows.length"
                @click="emits('bulkUpdateDlg')"
              >
                <div v-e="['a:row:update-bulk']" class="flex gap-2 items-center">
                  <component :is="iconMap.ncEdit" />
                  {{ $t('title.updateSelectedRows') }}
                </div>
              </NcMenuItem>

              <NcMenuItem
                v-if="!contextMenuClosing && !contextMenuTarget && !isDataReadOnly && selectedRows.length"
                class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
                data-testid="nc-delete-row"
                @click="deleteSelectedRows"
              >
                <div v-if="selectedRows.length === 1" v-e="['a:row:delete']" class="flex gap-2 items-center">
                  <component :is="iconMap.delete" />
                  {{ $t('activity.deleteSelectedRow') }}
                </div>
                <div v-else v-e="['a:row:delete-bulk']" class="flex gap-2 items-center">
                  <component :is="iconMap.delete" />
                  {{ $t('activity.deleteSelectedRow') }}
                </div>
              </NcMenuItem>
            </template>
            <NcMenuItem
              v-if="vSelectedAllRecords"
              class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
              data-testid="nc-delete-all-row"
              @click="deleteAllRecords"
            >
              <div v-e="['a:row:delete-all']" class="flex gap-2 items-center">
                <component :is="iconMap.delete" />
                {{ $t('activity.deleteAllRecords') }}
              </div>
            </NcMenuItem>
            <template v-if="isOrderColumnExists && hasEditPermission && !isDataReadOnly && isPkAvail">
              <NcMenuItem
                v-if="contextMenuTarget"
                class="nc-base-menu-item"
                data-testid="context-menu-item-add-above"
                @click="callAddNewRow(contextMenuTarget, 'above')"
              >
                <div v-e="['a:row:insert:above']" class="flex gap-2 items-center">
                  <GeneralIcon icon="ncChevronUp" />
                  {{ $t('general.insertAbove') }}
                </div>
              </NcMenuItem>

              <NcMenuItem
                v-if="contextMenuTarget && !isInsertBelowDisabled"
                class="nc-base-menu-item"
                data-testid="context-menu-item-add-below"
                @click="callAddNewRow(contextMenuTarget, 'below')"
              >
                <div v-e="['a:row:insert:below']" class="flex gap-2 items-center">
                  <GeneralIcon icon="ncChevronDown" />
                  {{ $t('general.insertBelow') }}
                </div>
              </NcMenuItem>
              <NcDivider />
            </template>

            <NcTooltip
              v-if="contextMenuTarget && hasEditPermission && !isDataReadOnly && isSelectedOnlyAI.enabled"
              :disabled="!isSelectedOnlyAI.disabled"
            >
              <template #title>
                {{
                  aiIntegrations.length ? $t('tooltip.aiIntegrationReConfigure') : $t('tooltip.aiIntegrationAddAndReConfigure')
                }}
              </template>
              <NcMenuItem
                class="nc-base-menu-item"
                data-testid="context-menu-item-bulk"
                :disabled="isSelectedOnlyAI.disabled"
                @click="generateAIBulk"
              >
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
                  <!-- Generate All -->
                  Generate {{ selectedRange.isSingleCell() ? 'Cell' : 'All' }}
                </div>
              </NcMenuItem>
            </NcTooltip>

            <NcMenuItem
              v-if="isSelectedOnlyScript.enabled"
              class="nc-base-menu-item"
              data-testid="context-menu-item-bulk-script"
              :disabled="isSelectedOnlyScript.disabled"
              @click="bulkExecuteScript"
            >
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="ncScript" class="h-4 w-4" />
                <!-- Generate All -->
                Execute {{ selectedRange.isSingleCell() ? 'Cell' : 'All' }}
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="contextMenuTarget"
              class="nc-base-menu-item"
              data-testid="context-menu-item-copy"
              @click="copyValue(contextMenuTarget)"
            >
              <div v-e="['a:row:copy']" class="flex gap-2 items-center">
                <GeneralIcon icon="copy" />
                <!-- Copy -->
                {{ $t('general.copy') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="contextMenuTarget && hasEditPermission && !isDataReadOnly"
              class="nc-base-menu-item"
              data-testid="context-menu-item-paste"
              :disabled="selectedReadonly"
              @click="paste"
            >
              <div v-e="['a:row:paste']" class="flex gap-2 items-center">
                <GeneralIcon icon="paste" />
                <!-- Paste -->
                {{ $t('general.paste') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <!-- Clear cell -->
            <NcMenuItem
              v-if="
                contextMenuTarget &&
                hasEditPermission &&
                selectedRange.isSingleCell() &&
                (isLinksOrLTAR(fields[contextMenuTarget.col]) || !cellMeta[0]?.[contextMenuTarget.col].isVirtualCol) &&
                !isDataReadOnly
              "
              class="nc-base-menu-item"
              :disabled="selectedReadonly"
              data-testid="context-menu-item-clear"
              @click="clearCell(contextMenuTarget)"
            >
              <div v-e="['a:row:clear']" class="flex gap-2 items-center">
                <GeneralIcon icon="close" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <!-- Clear cell -->
            <NcMenuItem
              v-else-if="contextMenuTarget && hasEditPermission && !isDataReadOnly"
              class="nc-base-menu-item"
              :disabled="selectedReadonly"
              data-testid="context-menu-item-clear"
              @click="clearSelectedRangeOfCells()"
            >
              <div v-e="['a:row:clear-range']" class="flex gap-2 items-center">
                <GeneralIcon icon="closeBox" class="text-gray-500" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <template v-if="contextMenuTarget && selectedRange.isSingleCell() && isUIAllowed('commentEdit') && !isMobileMode">
              <NcDivider />
              <NcMenuItem class="nc-base-menu-item" @click="commentRow(contextMenuTarget.row)">
                <div v-e="['a:row:comment']" class="flex gap-2 items-center">
                  <MdiMessageOutline class="h-4 w-4" />
                  {{ $t('general.add') }} {{ $t('general.comment').toLowerCase() }}
                </div>
              </NcMenuItem>
            </template>

            <template v-if="hasEditPermission && !isDataReadOnly">
              <NcDivider v-if="!(!contextMenuClosing && !contextMenuTarget && (selectedRows.length || vSelectedAllRecords))" />
              <NcMenuItem
                v-if="contextMenuTarget && (selectedRange.isSingleCell() || selectedRange.isSingleRow())"
                class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
                @click="confirmDeleteRow(contextMenuTarget.row)"
              >
                <div v-e="['a:row:delete']" class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  <!-- Delete Row -->
                  {{ $t('activity.deleteRow') }}
                </div>
              </NcMenuItem>
              <NcMenuItem
                v-else-if="contextMenuTarget && deleteRangeOfRows"
                class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
                @click="deleteSelectedRangeOfRows"
              >
                <div v-e="['a:row:delete']" class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" class="text-gray-500 text-red-600" />
                  <!-- Delete Rows -->
                  {{ $t('activity.deleteRows') }}
                </div>
              </NcMenuItem>
            </template>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <div class="absolute bottom-12 z-5 left-2" @click.stop>
      <NcDropdown v-if="isAddingEmptyRowAllowed">
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
            v-e="[isAddNewRecordGridMode ? 'c:row:add:grid' : 'c:row:add:form']"
            class="!rounded-r-none !border-r-0 nc-grid-add-new-row"
            size="small"
            type="secondary"
            :shadow="false"
            @click.stop="isAddNewRecordGridMode ? addEmptyRow() : onNewRecordToFormClick()"
          >
            <div data-testid="nc-pagination-add-record" class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              <template v-if="isAddNewRecordGridMode">
                {{ $t('activity.newRecord') }}
              </template>
              <template v-else> {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }} </template>
            </div>
          </NcButton>
          <NcButton
            v-if="!isMobileMode"
            size="small"
            class="!rounded-l-none nc-add-record-more-info"
            type="secondary"
            :shadow="false"
          >
            <GeneralIcon icon="arrowUp" />
          </NcButton>
        </div>

        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem v-e="['c:row:add:grid']" class="nc-new-record-with-grid group" @click="onNewRecordToGridClick">
              <div class="flex flex-row items-center justify-start gap-x-3">
                <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
                {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
              </div>

              <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
            </NcMenuItem>
            <NcMenuItem v-e="['c:row:add:form']" class="nc-new-record-with-form group" @click="onNewRecordToFormClick">
              <div class="flex flex-row items-center justify-start gap-x-3">
                <component :is="viewIcons[ViewTypes.FORM]?.icon" class="nc-view-icon text-inherit" />
                {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}
              </div>

              <GeneralIcon v-if="!isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <LazySmartsheetGridPaginationV2 :total-rows="totalRows" :scroll-left="scrollLeft" :disable-pagination="true" />
  </div>
</template>

<style lang="scss">
.dragging-record {
  @apply h-0.5 absolute z-4;
  background-color: #3366ff;
}

.is-dragging {
  @apply opacity-50;
}
@keyframes dotFade {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}
@keyframes dotBounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
</style>

<style scoped lang="scss">
.nc-grid-wrapper {
  @apply h-full w-full;

  .nc-grid-add-edit-column {
    @apply bg-gray-50;
  }

  .nc-grid-add-new-cell:hover td {
    @apply text-black !bg-gray-50;
  }

  td:not(.nc-grid-add-new-cell-item),
  th {
    @apply border-gray-100 border-solid border-r bg-gray-100 p-0;
    min-height: 32px !important;
    height: 32px !important;
    position: relative;
  }

  th {
    @apply border-b-1 border-gray-200;

    :deep(.name) {
      @apply text-small;
    }

    :deep(.nc-cell-icon),
    :deep(.nc-virtual-cell-icon) {
      @apply !w-3.5 !h-3.5 !text-small;
    }
  }

  .nc-grid-header th:last-child {
    @apply !border-b-1;
  }

  td:not(.nc-grid-add-new-cell-item) {
    @apply bg-white border-b;
  }

  td:not(:first-child):not(.nc-grid-add-new-cell-item) {
    @apply px-3;

    &.align-top {
      @apply py-2;

      &:has(.nc-cell.nc-cell-longtext textarea) {
        @apply py-0 pr-0;
      }
    }

    &.align-middle {
      @apply py-0;

      &:has(.nc-cell.nc-cell-longtext textarea) {
        @apply pr-0;
      }
    }

    & > div {
      overflow: hidden;
      @apply flex h-auto;
    }
    &.active-cell {
      :deep(.nc-cell) {
        a.nc-cell-field-link {
          @apply !text-brand-500;

          &:hover,
          .nc-cell-field {
            @apply !text-brand-500;
          }
        }
      }
    }
    :deep(.nc-cell),
    :deep(.nc-virtual-cell) {
      @apply !text-small;

      .nc-cell-field,
      input,
      textarea {
        @apply !text-small !pl-0 !py-0 m-0;
      }

      &:not(.nc-display-value-cell) {
        @apply text-gray-600;
        font-weight: 500;

        .nc-cell-field,
        input,
        textarea {
          @apply text-gray-600;
          font-weight: 500;
        }
      }

      .nc-cell-field,
      a.nc-cell-field-link,
      input,
      textarea {
        @apply !pl-0 !py-0 m-0;
      }

      a.nc-cell-field-link {
        @apply !text-current;
        &:hover {
          @apply !text-current;
        }
      }

      &.nc-cell-longtext {
        @apply leading-[18px];

        textarea {
          @apply pr-8 !py-2;
        }
      }

      .ant-picker-input {
        @apply text-small leading-4;
        font-weight: 500;

        input {
          @apply text-small leading-4;
          font-weight: 500;
        }
      }

      &.nc-cell-attachment {
        .nc-attachment-cell {
          .nc-attachment-wrapper {
            @apply !py-0.5;

            .nc-attachment {
              @apply !min-h-4;
            }
          }
        }
      }

      &.nc-cell-longtext .long-text-wrapper .nc-rich-text-grid {
        @apply pl-0 -ml-1;
      }

      .ant-select:not(.ant-select-customize-input) {
        .ant-select-selector {
          @apply !border-none flex-nowrap pr-4.5;
        }
        .ant-select-arrow,
        .ant-select-clear {
          @apply right-[3px];
        }
      }
      .ant-select-selection-search-input {
        @apply !h-[23px];
      }

      .ant-select-single:not(.ant-select-customize-input) .ant-select-selector {
        @apply !h-auto;
      }
    }
  }

  table {
    background-color: var(--nc-grid-bg);

    border-collapse: separate;
    border-spacing: 0;
  }

  td:not(.nc-grid-add-new-cell-item) {
    text-overflow: ellipsis;
  }

  td.active::after {
    content: '';
    position: absolute;
    z-index: 3;
    height: calc(100%);
    width: calc(100% + 2px);
    left: -1px;
    top: -1px;
    pointer-events: none;
  }

  // todo: replace with css variable
  td.active::after {
    @apply text-primary border-current bg-primary bg-opacity-5;
  }

  td.active.readonly::after {
    @apply text-primary bg-grey-50 bg-opacity-5 !border-gray-200;
  }

  td.active-cell::after {
    @apply bg-opacity-3;
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    box-shadow: 0 0 0 1.5px #3366ff !important;
    border-radius: 2px;
  }

  td.filling::after {
    content: '';
    position: absolute;
    z-index: 3;
    height: calc(100% + 2px);
    width: calc(100% + 2px);
    left: -1px;
    top: -1px;
    pointer-events: none;
  }

  // todo: replace with css variable
  td.filling::after {
    @apply border-1 border-dashed text-primary border-current bg-gray-100 bg-opacity-50;
  }

  //td.active::before {
  //  content: '';
  //  z-index:4;
  //  @apply absolute !w-[10px] !h-[10px] !right-[-5px] !bottom-[-5px] bg-primary;
  //}

  thead th:nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 5;
  }

  tbody td:not(.placeholder-column):not(.nc-grid-add-new-cell-item):nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 4;
    background: white;
  }

  .desktop {
    thead th:nth-child(2) {
      position: sticky !important;
      z-index: 5;
      left: 80px;
      @apply border-r-1 border-r-gray-200;
    }

    tbody tr:not(.nc-grid-add-new-cell):not(.placeholder) td:not(.placeholder-column):nth-child(2) {
      position: sticky !important;
      z-index: 4;
      left: 80px;
      background: white;
      @apply border-r-1 border-r-gray-100;
    }

    tbody {
      tr:not(.nc-grid-add-new-cell):not(.placeholder) td:nth-child(3) {
        &.active-cell {
          @apply border-l-[1.5px] !border-l-transparent;
        }
        &.filling::after {
          left: 0px;
        }
      }

      tr:not(.nc-grid-add-new-cell):not(.placeholder):nth-child(1) td {
        &.active-cell {
          @apply border-t-[1.5px] !border-t-transparent;
        }
        &.filling::after {
          top: 0px;
        }
      }

      tr:not(.nc-grid-add-new-cell):not(.placeholder):nth-last-child(2) td {
        &.active-cell {
          @apply border-b-[1.5px] !border-b-transparent;
        }
        &.filling::after {
          bottom: 0px;
        }
      }
    }
  }

  .nc-grid-skeleton-loader {
    thead th:nth-child(2) {
      @apply border-r-1 !border-r-gray-50;
    }

    tbody td:not(.placeholder-column):not(.nc-grid-add-new-cell-item):nth-child(2) {
      @apply border-r-1 !border-r-gray-50;
    }
  }
}

:deep(.resizer:hover),
:deep(.resizer:active),
:deep(.resizer:focus) {
  // todo: replace with primary color
  @apply bg-blue-500/50;
  cursor: col-resize;
}

.nc-grid-row {
  .nc-row-expand-and-checkbox {
    @apply !xs:hidden items-center justify-between;
  }

  .nc-row-spinner {
    @apply hidden;
  }

  .nc-expand {
    &:not(.nc-comment) {
      @apply hidden;
    }

    &.nc-comment {
      display: flex;
    }
  }

  &.active-row,
  &:not(.mouse-down):hover {
    .nc-row-no.toggle {
      @apply hidden;
    }

    .nc-drag-handle {
      @apply block;
    }

    .nc-expand {
      @apply flex;
    }

    .nc-row-spinner {
      @apply block;
    }

    .nc-row-expand-and-checkbox {
      @apply !xs:hidden !flex;
    }

    &:not(.selected-row) {
      td.nc-grid-cell:not(.active),
      td:nth-child(2):not(.active) {
        @apply !bg-gray-50 border-b-gray-200 border-r-gray-200;
      }
    }
  }

  &.selected-row {
    td.nc-grid-cell:not(.active),
    td:nth-child(2):not(.active) {
      @apply !bg-[#F0F3FF] border-b-gray-200 border-r-gray-200;
    }
  }

  &:not(.selected-row):has(+ .selected-row) {
    td.nc-grid-cell:not(.active),
    td:nth-child(2):not(.active):not(.nc-grid-add-new-cell-item) {
      @apply border-b-gray-200;
    }
  }

  &:not(.active-row):has(+ .active-row),
  &:not(.mouse-down):has(+ :hover) {
    &:not(.selected-row) {
      td.nc-grid-cell:not(.active),
      td:nth-child(2):not(.active):not(.nc-grid-add-new-cell-item) {
        @apply border-b-gray-200;
      }
    }
  }
}

.nc-grid-header {
  &:hover {
    .nc-no-label {
      @apply hidden;
    }

    .nc-check-all {
      @apply flex;
    }
  }
}

.invalid-row {
  @apply transform scale-y-105 -translate-y-2 transition-transform;
  position: relative;
  z-index: 10000;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 97%;
    box-shadow: 0 0 0 2px #fcbe3a !important;
    pointer-events: none;
  }
}

.nc-required-cell {
  box-shadow: inset 0 0 2px #f00;
}

.nc-fill-handle {
  @apply w-[6px] h-[6px] absolute rounded-full bg-red-500 !pointer-events-auto mt-[-4px] ml-[-4px];
}

.nc-fill-handle:hover,
.nc-fill-handle:active,
.nc-fill-handle:focus {
  @apply w-[8px] h-[8px] mt-[-5px] ml-[-5px];
}

:deep(.ant-skeleton-input) {
  @apply rounded text-gray-100 !bg-gray-100 !bg-opacity-65;
  animation: slow-show-1 5s ease 5s forwards;
}

.nc-grid-add-new-row {
  :deep(.ant-btn.ant-dropdown-trigger.ant-btn-icon-only) {
    @apply !flex items-center justify-center;
  }
}

.placeholder {
  background-color: #ffffff;
  background-image: linear-gradient(0deg, #f4f4f5 1.52%, #fff 0, #fff 50%, #f4f4f5 0, #f4f4f5 51.52%, #fff 0, #fff);
  background-size: 66px 66px;
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
}

.placeholder-column {
  border-right: 1px solid #f4f4f5;
  bottom: 0;
  position: absolute;
  top: 0;
}

.top-placeholder {
  top: 0;
}

.bottom-placeholder {
  bottom: 0;
}
</style>
