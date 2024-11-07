<script setup lang="ts">
import {
  type ColumnReqType,
  type ColumnType,
  type TableType,
  UITypes,
  type ViewType,
  ViewTypes,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'

import axios from 'axios'
import { useColumnDrag } from './useColumnDrag'
import { type CellRange, NavigateDir, type Row } from '#imports'

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
  ) => Promise<any>
  deleteSelectedRows?: () => Promise<void>
  clearInvalidRows?: () => void
  deleteRangeOfRows?: (cellRange: CellRange) => Promise<void>
  bulkUpdateRows?: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
  removeRowIfNew?: (row: Row) => void
  clearCache: (visibleStartIndex: number, visibleEndIndex: number) => void
  syncCount: () => Promise<void>
  selectedRows: Array<Row>
  chunkStates: Array<'loading' | 'loaded' | undefined>
}>()

const emits = defineEmits(['bulkUpdateDlg'])

const {
  loadData,
  callAddEmptyRow,
  updateOrSaveRow,
  deleteRow,
  expandForm,
  clearCache,
  syncCount,
  bulkUpdateRows,
  deleteRangeOfRows,
  removeRowIfNew,
  clearInvalidRows,
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

const { isPkAvail, isSqlView, eventBus } = useSmartsheetStoreOrThrow()

const { $e } = useNuxtApp()

const { api } = useApi()

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

const {
  predictingNextColumn,
  predictedNextColumn,
  predictingNextFormulas,
  predictedNextFormulas,
  predictNextColumn,
  predictNextFormulas,
} = useNocoEe().table

const { paste } = usePaste()

const { addLTARRef, syncLTARRefs, clearLTARCell, cleaMMCell } = useSmartsheetLtarHelpersOrThrow()

const { loadViewAggregate } = useViewAggregateOrThrow()

// Element refs
const smartTable = ref(null)

const tableBodyEl = ref<HTMLElement>()

const gridWrapper = ref<HTMLElement>()

const tableHeadEl = ref<HTMLElement>()

const fillHandle = ref<HTMLElement>()

const { height: tableHeadHeight } = useElementBounding(tableHeadEl)

const isViewColumnsLoading = computed(() => _isViewColumnsLoading.value || !meta.value)

const resizingColumn = ref(false)

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
}

const onXcStartResizing = (cn: string | undefined, event: any) => {
  if (!cn) return
  resizingColOldWith.value = event.detail
  resizingColumn.value = true
}

const cachedRows = toRef(props, 'data')

const totalRows = toRef(props, 'totalRows')

const chunkStates = toRef(props, 'chunkStates')

const rowHeight = computed(() => rowHeightInPx[`${props.rowHeightEnum}`])

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

  chunkStates.value[chunkId] = 'loading'
  if (isInitialLoad) {
    chunkStates.value[chunkId + 1] = 'loading'
  }
  const offset = chunkId * CHUNK_SIZE
  const limit = isInitialLoad ? INITIAL_LOAD_SIZE : CHUNK_SIZE

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

const visibleRows = computed(() => {
  const { start, end } = rowSlice
  return Array.from({ length: Math.min(end, totalRows.value) - start }, (_, i) => {
    const rowIndex = start + i
    return cachedRows.value.get(rowIndex) || { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } }
  })
})

const updateVisibleRows = async () => {
  const { start, end } = rowSlice

  const firstChunkId = Math.floor(start / CHUNK_SIZE)
  const lastChunkId = Math.floor((end - 1) / CHUNK_SIZE)

  const chunksToFetch = new Set()

  for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
    if (!chunkStates.value[chunkId]) chunksToFetch.add(chunkId)
  }

  const nextChunkId = lastChunkId + 1
  if (end % CHUNK_SIZE > CHUNK_SIZE - PREFETCH_THRESHOLD && !chunkStates.value[nextChunkId]) {
    chunksToFetch.add(nextChunkId)
  }

  if (chunksToFetch.size > 0) {
    const isInitialLoad = firstChunkId === 0 && !chunkStates.value[0]

    if (isInitialLoad) {
      await fetchChunk(0, true)
      chunksToFetch.delete(0)
      chunksToFetch.delete(1)
    }

    await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId)))
  }

  clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))
}

const { isUIAllowed, isDataReadOnly } = useRoles()
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))
const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('fieldAdd') && !isSqlView.value)

const { onDrag, onDragStart, onDragEnd, draggedCol, dragColPlaceholderDomRef, toBeDroppedColId } = useColumnDrag({
  fields,
  tableBodyEl,
  gridWrapper,
})

const addColumnDropdown = ref(false)

const altModifier = ref(false)

const persistMenu = ref(false)

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
              await api.dbDataTableRow.nestedLink(
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
    return fields.value.map((col) => {
      return {
        isColumnRequiredAndNull: isColumnRequiredAndNull(col, row.row),
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
    if (isDrawerOrModalExist()) {
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
          scrollToCell?.(undefined, undefined, 'instant')
          editEnabled.value = false
          return true
        case 'ArrowDown':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = totalRows.value - 1
          activeCell.col = activeCell.col ?? 0
          scrollToCell?.(undefined, undefined, 'instant')
          editEnabled.value = false
          return true
        case 'ArrowRight':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = fields.value?.length - 1
          scrollToCell?.()
          editEnabled.value = false
          return true
        case 'ArrowLeft':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = 0
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
  fillHandle,
  view,
  undefined,
  undefined,
  fetchChunk,
)

function scrollToRow(row?: number) {
  clearSelectedRange()
  makeActive(row ?? totalRows.value - 1, 0)
  selectedRange.startRange({ row: activeCell.row!, col: activeCell.col! })
  scrollToCell?.(row)
}

async function saveEmptyRow(rowObj: Row) {
  await updateOrSaveRow?.(rowObj)
}

let disableWatch = false

async function addEmptyRow(row?: number, skipUpdate: boolean = false) {
  const rowObj = callAddEmptyRow?.(row)
  disableWatch = true
  setTimeout(() => {
    disableWatch = false
  }, 1000)

  if (!skipUpdate && rowObj) {
    await saveEmptyRow(rowObj)
  }

  await nextTick(() => {})

  scrollToRow(row ?? totalRows.value - 1)
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
      return +gridViewCols.value[col.id!]!.width!.replace('px', '') || 200
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
        col === fields.value.length - 1 ? colPositions.value[colPositions.value.length - 1] + 200 : colPositions.value[col + 1],
      bottom: (row + 1) * rowHeight.value,
    }

    const tdScroll = getContainerScrollForElement(td, gridWrapper.value, {
      top: 9,
      bottom: (tableHeadHeight.value || 40) + 9,
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

const loadColumn = (title: string, tp: string, colOptions?: any) => {
  preloadColumn.value = {
    title,
    uidt: tp,
    colOptions,
  }
  persistMenu.value = false
}

const editOrAddProviderRef = ref()

const onVisibilityChange = () => {
  addColumnDropdown.value = true
  if (!editOrAddProviderRef.value?.isWebHookModalOpen()) {
    addColumnDropdown.value = false
    // persistMenu.value = altModifier
  }
}

const COL_VIRTUAL_MARGIN = 5
const ROW_VIRTUAL_MARGIN = 10

const activeVerticalMargin = computed(() => {
  return chunkStates.value.includes('loading') ? 5 : ROW_VIRTUAL_MARGIN
})

const colSlice = ref({
  start: 0,
  end: 0,
})

const lastScrollTop = ref()
const lastScrollLeft = ref()
const lastTotalRows = ref()

const calculateSlices = () => {
  // if the grid is not rendered yet
  if (!gridWrapper.value || !gridWrapper.value) {
    colSlice.value = {
      start: 0,
      end: 0,
    }

    // try again until the grid is rendered
    setTimeout(calculateSlices, 50)
    return
  }

  // skip calculation if scrolling only vertical & scroll is smaller than (ROW_VIRTUAL_MARGIN - 2) x smallest row height
  if (
    lastScrollLeft.value &&
    lastScrollLeft.value === scrollLeft.value &&
    Math.abs(lastScrollTop.value - scrollTop.value) < 32 * (activeVerticalMargin.value - 2) &&
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

  colSlice.value = {
    start: Math.max(0, renderStart - COL_VIRTUAL_MARGIN),
    end: renderEndFound ? Math.min(fields.value.length, renderEnd + COL_VIRTUAL_MARGIN) : fields.value.length,
  }

  const startIndex = Math.max(0, Math.floor(scrollTop.value / rowHeight.value))
  const visibleCount = Math.ceil(gridWrapper.value.clientHeight / rowHeight.value)
  const endIndex = Math.min(startIndex + visibleCount, totalRows.value)

  const newStart = Math.max(0, startIndex - activeVerticalMargin.value)
  const newEnd = Math.min(totalRows.value, Math.max(endIndex + activeVerticalMargin.value, newStart + 50))

  if (
    Math.abs(newStart - rowSlice.start) >= activeVerticalMargin.value / 2 ||
    Math.abs(newEnd - rowSlice.end) >= activeVerticalMargin.value / 2 ||
    lastTotalRows.value !== totalRows.value
  ) {
    rowSlice.start = newStart
    rowSlice.end = newEnd

    updateVisibleRows()
    lastTotalRows.value = totalRows.value
  }
}

const visibleFields = computed(() => {
  // return data as { field, index } to keep track of the index
  const vFields = fields.value.slice(colSlice.value.start, colSlice.value.end)
  return vFields.map((field, index) => ({ field, index: index + colSlice.value.start })).filter((f) => f.index !== 0)
})

const leftOffset = computed(() => {
  return colSlice.value.start > 0 ? colPositions.value[colSlice.value.start] - colPositions.value[1] : 0
})

// Fill Handle
const fillHandleTop = ref()
const fillHandleLeft = ref()

const refreshFillHandle = () => {
  const rowIndex = isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row
  const colIndex = isNaN(selectedRange.end.col) ? activeCell.col : selectedRange.end.col
  if (rowIndex !== null && colIndex !== null) {
    if (!gridWrapper.value || !gridWrapper.value) return

    // 32 for the header
    fillHandleTop.value = (rowIndex + 1) * rowHeight.value + 32
    // 64 for the row number column
    fillHandleLeft.value =
      64 +
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

const reloadViewDataHookHandler = async () => {
  // If the scroll Position is not at the top, scroll to the top
  // This always loads the first page of data when the view data is reloaded
  gridWrapper.value?.scrollTo(0, 0)
  await saveOrUpdateRecords({
    keepNewRecords: true,
  })

  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)

  await syncCount()

  calculateSlices()

  await updateVisibleRows()

  temporaryNewRowStore.value.forEach((row, index) => {
    row.rowMeta.rowIndex = totalRows.value + index
    cachedRows.value.set(totalRows.value + index, row)
  })
}

let scrollRaf = false

useScroll(gridWrapper, {
  onScroll: (e) => {
    if (scrollRaf) return

    scrollRaf = true
    requestAnimationFrame(() => {
      scrollLeft.value = e.target?.scrollLeft
      scrollTop.value = e.target?.scrollTop
      calculateSlices()
      refreshFillHandle()
      scrollRaf = false
    })
  },
  throttle: 100,
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

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const isRichModalOpen = isExpandedCellInputExist()

  if (e.key === 'Alt' && !isRichModalOpen) {
    altModifier.value = true
  }
})

useEventListener(document, 'keyup', async (e: KeyboardEvent) => {
  const isRichModalOpen = isExpandedCellInputExist()

  if (e.key === 'Alt' && !isRichModalOpen) {
    altModifier.value = false
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

watch(
  () => activeCell.row,
  (newVal, oldVal) => {
    if (disableWatch) return
    if (oldVal !== newVal) {
      clearInvalidRows?.()
    }
  },
  { immediate: true },
)

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
  return colPositions.value[colPositions.value.length - 1] + 64
})

const maxGridHeight = computed(() => {
  return totalRows.value * (isMobileMode.value ? 56 : rowHeight.value)
})

const startRowHeight = computed(() => `${rowSlice.start * rowHeight.value}px`)

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

    <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 relative !overflow-auto">
      <NcDropdown
        v-model:visible="contextMenu"
        :disabled="contextMenuTarget === null && !selectedRows.length"
        :trigger="isSqlView ? [] : ['contextmenu']"
        overlay-class-name="nc-dropdown-grid-context-menu"
      >
        <div>
          <table
            :class="{
              mobile: isMobileMode,
              desktop: !isMobileMode,
            }"
            class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white sticky top-0 z-5 bg-white"
          >
            <thead ref="tableHeadEl">
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
              <tr
                v-show="!isViewColumnsLoading"
                :style="{
                  transform: `translateX(${leftOffset}px)`,
                }"
                class="nc-grid-header transform"
              >
                <th
                  ref="numColHeader"
                  class="w-[64px] min-w-[64px]"
                  :style="{
                    left: `-${leftOffset}px`,
                  }"
                  data-testid="grid-id-column"
                >
                  <div class="w-full h-full text-gray-500 flex pl-2 pr-1 items-center" data-testid="nc-check-all">#</div>
                </th>
                <th
                  v-if="fields[0] && fields[0].id"
                  ref="primaryColHeader"
                  v-xc-ver-resize
                  :data-col="fields[0].id"
                  :data-title="fields[0].title"
                  :style="{
                    'min-width': gridViewCols[fields[0].id]?.width || '180px',
                    'max-width': gridViewCols[fields[0].id]?.width || '180px',
                    'width': gridViewCols[fields[0].id]?.width || '180px',
                    ...(leftOffset > 0
                      ? {
                          left: `-${leftOffset - 64}px`,
                        }
                      : {}),
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
                  v-for="{ field: col, index } in visibleFields"
                  :key="col.id"
                  v-xc-ver-resize
                  :data-col="col.id"
                  :data-title="col.title"
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
                      overlay-class-name="nc-dropdown-grid-add-column"
                      @visible-change="onVisibilityChange"
                    >
                      <div class="h-full w-[60px] flex items-center justify-center">
                        <GeneralIcon v-if="isEeUI && (altModifier || persistMenu)" icon="magic" class="text-sm text-orange-400" />
                        <component :is="iconMap.plus" class="text-base nc-column-add text-gray-500 !group-hover:text-black" />
                      </div>
                      <template v-if="isEeUI && persistMenu" #overlay>
                        <NcMenu>
                          <a-sub-menu v-if="predictedNextColumn?.length" key="predict-column">
                            <template #title>
                              <div class="flex flex-row items-center py-3">
                                <MdiTableColumnPlusAfter class="flex h-[1rem] text-gray-500" />
                                <div class="text-xs pl-2">
                                  {{ $t('activity.predictColumns') }}
                                </div>
                                <MdiChevronRight class="text-gray-500 ml-2" />
                              </div>
                            </template>
                            <template #expandIcon></template>
                            <NcMenu>
                              <template v-for="col in predictedNextColumn" :key="`predict-${col.title}-${col.type}`">
                                <NcMenuItem>
                                  <div class="flex flex-row items-center py-3" @click="loadColumn(col.title, col.type)">
                                    <div class="text-xs pl-2">{{ col.title }}</div>
                                  </div>
                                </NcMenuItem>
                              </template>

                              <NcMenuItem>
                                <div class="flex flex-row items-center py-3" @click="predictNextColumn">
                                  <div class="text-red-500 text-xs pl-2">
                                    <MdiReload />
                                    Generate Again
                                  </div>
                                </div>
                              </NcMenuItem>
                            </NcMenu>
                          </a-sub-menu>
                          <NcMenuItem v-else>
                            <!-- Predict Columns -->
                            <div class="flex flex-row items-center py-3" @click="predictNextColumn">
                              <MdiReload v-if="predictingNextColumn" class="animate-infinite animate-spin" />
                              <MdiTableColumnPlusAfter v-else class="flex h-[1rem] text-gray-500" />
                              <div class="text-xs pl-2">
                                {{ $t('activity.predictColumns') }}
                              </div>
                            </div>
                          </NcMenuItem>
                          <a-sub-menu v-if="predictedNextFormulas" key="predict-formula">
                            <template #title>
                              <div class="flex flex-row items-center py-3">
                                <MdiCalculatorVariant class="flex h-[1rem] text-gray-500" />
                                <div class="text-xs pl-2">
                                  {{ $t('activity.predictFormulas') }}
                                </div>
                                <MdiChevronRight class="text-gray-500 ml-2" />
                              </div>
                            </template>
                            <template #expandIcon></template>
                            <NcMenu>
                              <template v-for="col in predictedNextFormulas" :key="`predict-${col.title}-formula`">
                                <NcMenuItem>
                                  <div
                                    class="flex flex-row items-center py-3"
                                    @click="
                                      loadColumn(col.title, 'Formula', {
                                        formula_raw: col.formula,
                                      })
                                    "
                                  >
                                    <div class="text-xs pl-2">{{ col.title }}</div>
                                  </div>
                                </NcMenuItem>
                              </template>
                            </NcMenu>
                          </a-sub-menu>
                          <NcMenuItem v-else>
                            <!-- Predict Formulas -->
                            <div class="flex flex-row items-center py-3" @click="predictNextFormulas">
                              <MdiReload v-if="predictingNextFormulas" class="animate-infinite animate-spin" />
                              <MdiCalculatorVariant v-else class="flex h-[1rem] text-gray-500" />
                              <div class="text-xs pl-2">
                                {{ $t('activity.predictFormulas') }}
                              </div>
                            </div>
                          </NcMenuItem>
                        </NcMenu>
                      </template>
                      <template v-else #overlay>
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
          <div
            class="table-overlay"
            :style="{
              height: `${maxGridHeight + 256}px`,
              width: `${maxGridWidth}px`,
            }"
          >
            <table
              ref="smartTable"
              class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white relative"
              :class="{
                'mobile': isMobileMode,
                'desktop': !isMobileMode,
                'w-full': visibleRows?.length === 0,
              }"
              @contextmenu="showContextMenu"
            >
              <thead v-if="+startRowHeight.split('px')[0] > 32">
                <tr class="placeholder top-placeholder" :style="`height: ${startRowHeight};`">
                  <td
                    class="placeholder-column"
                    :style="{
                      width: '64px',
                      left: '0px',
                    }"
                  ></td>
                  <td
                    v-for="(columnObj, index) in visibleFields"
                    :key="`placeholder-top-${index}`"
                    class="placeholder-column"
                    :style="{
                      width: gridViewCols[columnObj.field.id]?.width || '180px',
                      left: `${
                        64 + (gridViewCols[fields[0].id]?.width || 180) + index * (gridViewCols[columnObj.field.id]?.width || 180)
                      }px`,
                    }"
                  ></td>
                </tr>
              </thead>
              <tbody
                ref="tableBodyEl"
                :style="{
                  transform: `translateX(${leftOffset}px) translateY(${rowSlice.start * rowHeight}px)`,
                }"
              >
                <LazySmartsheetRow
                  v-for="(row, index) in visibleRows"
                  :key="`${row.rowMeta.rowIndex}-${row.rowMeta?.new}-${row.rowMeta.isValidationFailed}`"
                  :row="row"
                >
                  <template #default="{ state }">
                    <div
                      v-if="row.rowMeta?.isValidationFailed"
                      :style="{
                        left: `${leftOffset}px`,
                        top: `${(index + 1) * rowHeight}px`,
                        zIndex: 100000,
                      }"
                      class="absolute bg-yellow-500 px-2 font-semibold py-1 z-30 left-0 rounded-br-md flex text-xs items-center gap-2 text-gray-800"
                    >
                      Row filtered

                      <NcTooltip>
                        <template #title>
                          This record will be hidden as it does not match the filters applied to this view.
                        </template>

                        <GeneralIcon icon="info" class="w-4 h-4 text-gray-800" />
                      </NcTooltip>
                    </div>
                    <tr
                      class="nc-grid-row transition transition-opacity duration-500 opacity-100 !xs:h-14"
                      :style="{
                        height: `${rowHeight}px`,
                      }"
                      :data-testid="`grid-row-${row.rowMeta.rowIndex}`"
                      :class="{
                        'active-row':
                          activeCell.row === row.rowMeta.rowIndex || selectedRange._start?.row === row.rowMeta.rowIndex,
                        'mouse-down': isGridCellMouseDown || isFillMode,
                        'selected-row': row.rowMeta.selected,
                        'invalid-row': row.rowMeta?.isValidationFailed,
                      }"
                    >
                      <td
                        key="row-index"
                        class="caption nc-grid-cell w-[64px] min-w-[64px]"
                        :data-testid="`cell-Id-${row.rowMeta.rowIndex}`"
                        :style="{
                          left: `-${leftOffset}px`,
                        }"
                        @contextmenu="contextMenuTarget = null"
                      >
                        <div class="w-[60px] pl-2 pr-1 items-center flex gap-1">
                          <div
                            class="nc-row-no sm:min-w-4 text-xs text-gray-500"
                            :class="{ toggle: !readOnly, hidden: row.rowMeta?.selected }"
                          >
                            {{ row.rowMeta.rowIndex + 1 }}
                          </div>
                          <div
                            v-if="!readOnly"
                            :class="{
                              hidden: !row.rowMeta?.selected,
                              flex: row.rowMeta?.selected,
                            }"
                            class="nc-row-expand-and-checkbox"
                          >
                            <a-checkbox
                              v-model:checked="row.rowMeta.selected"
                              :disabled="!row.rowMeta.selected && selectedRows.length > 100"
                            />
                          </div>
                          <span class="flex-1" />

                          <div
                            class="nc-expand"
                            :data-testid="`nc-expand-${row.rowMeta.rowIndex}`"
                            :class="{ 'nc-comment': row.rowMeta?.commentCount }"
                          >
                            <a-spin
                              v-if="row.rowMeta?.saving || row.rowMeta?.isLoading"
                              class="!flex items-center"
                              :data-testid="`row-save-spinner-${row.rowMeta.rowIndex}`"
                            />

                            <span
                              v-if="row.rowMeta?.commentCount && expandForm"
                              v-e="['c:expanded-form:open']"
                              class="px-1 rounded-md rounded-bl-none transition-all border-1 border-brand-200 text-xs cursor-pointer font-sembold select-none leading-5 text-brand-500 bg-brand-50"
                              @click="expandAndLooseFocus(row, state)"
                            >
                              {{ row.rowMeta.commentCount }}
                            </span>
                            <div
                              v-else-if="!row.rowMeta?.saving && !row.rowMeta?.isLoading"
                              class="cursor-pointer flex items-center border-1 border-gray-100 active:ring rounded p-1 hover:(bg-gray-50)"
                            >
                              <component
                                :is="iconMap.expand"
                                v-if="expandForm"
                                v-e="['c:row-expand:open']"
                                class="select-none transform hover:(text-black scale-120) nc-row-expand"
                                @click="expandAndLooseFocus(row, state)"
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <SmartsheetTableDataCell
                        v-if="fields[0]"
                        :key="fields[0].id"
                        class="cell relative nc-grid-cell cursor-pointer"
                        :class="{
                          'active': selectRangeMap[`${row.rowMeta.rowIndex}-0`],
                          'active-cell':
                            (activeCell.row === row.rowMeta.rowIndex && activeCell.col === 0) ||
                            (selectedRange._start?.row === row.rowMeta.rowIndex && selectedRange._start?.col === 0),
                          'nc-required-cell': cellMeta[index]?.[0]?.isColumnRequiredAndNull && !isPublicView,
                          'align-middle': !rowHeightEnum || rowHeightEnum === 1,
                          'align-top': rowHeightEnum && rowHeightEnum !== 1,
                          'filling': fillRangeMap[`${row.rowMeta.rowIndex}-0`],
                          'readonly':
                            colMeta[0]?.isReadonly && hasEditPermission && selectRangeMap?.[`${row.rowMeta.rowIndex}-0`],
                          '!border-r-blue-400 !border-r-3': toBeDroppedColId === fields[0].id,
                        }"
                        :style="{
                          'min-width': gridViewCols[fields[0].id]?.width || '180px',
                          'max-width': gridViewCols[fields[0].id]?.width || '180px',
                          'width': gridViewCols[fields[0].id]?.width || '180px',
                          ...(leftOffset > 0
                            ? {
                                left: `-${leftOffset - 64}px`,
                              }
                            : {}),
                        }"
                        :data-testid="`cell-${fields[0].title}-${row.rowMeta.rowIndex}`"
                        :data-key="`data-key-${row.rowMeta.rowIndex}-${fields[0].id}`"
                        :data-col="fields[0].id"
                        :data-title="fields[0].title"
                        :data-row-index="row.rowMeta.rowIndex"
                        :data-col-index="0"
                        @mousedown="handleMouseDown($event, row.rowMeta.rowIndex, 0)"
                        @mouseover="handleMouseOver($event, row.rowMeta.rowIndex, 0)"
                        @dblclick="makeEditable(row, fields[0])"
                        @contextmenu="showContextMenu($event, { row: row.rowMeta.rowIndex, col: 0 })"
                        @click="handleCellClick($event, row.rowMeta.rowIndex, 0)"
                      >
                        <div v-if="!switchingTab" class="w-full">
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
                      <SmartsheetTableDataCell
                        v-for="{ field: columnObj, index: colIndex } of visibleFields"
                        :key="`cell-${colIndex}-${row.rowMeta.rowIndex}`"
                        class="cell relative nc-grid-cell cursor-pointer"
                        :class="{
                          'active': selectRangeMap[`${row.rowMeta.rowIndex}-${colIndex}`],
                          'active-cell':
                            (activeCell.row === row.rowMeta.rowIndex && activeCell.col === colIndex) ||
                            (selectedRange._start?.row === row.rowMeta.rowIndex && selectedRange._start?.col === colIndex),
                          'nc-required-cell': cellMeta[index][colIndex].isColumnRequiredAndNull && !isPublicView,
                          'align-middle': !rowHeightEnum || rowHeightEnum === 1,
                          'align-top': rowHeightEnum && rowHeightEnum !== 1,
                          'filling': fillRangeMap[`${row.rowMeta.rowIndex}-${colIndex}`],
                          'readonly':
                            colMeta[colIndex].isReadonly &&
                            hasEditPermission &&
                            selectRangeMap[`${row.rowMeta.rowIndex}-${colIndex}`],
                          '!border-r-blue-400 !border-r-3': toBeDroppedColId === columnObj.id,
                        }"
                        :style="{
                          'min-width': gridViewCols[columnObj.id]?.width || '180px',
                          'max-width': gridViewCols[columnObj.id]?.width || '180px',
                          'width': gridViewCols[columnObj.id]?.width || '180px',
                        }"
                        :data-testid="`cell-${columnObj.title}-${row.rowMeta.rowIndex}`"
                        :data-key="`data-key-${row.rowMeta.rowIndex}-${columnObj.id}`"
                        :data-col="columnObj.id"
                        :data-title="columnObj.title"
                        :data-row-index="row.rowMeta.rowIndex"
                        :data-col-index="colIndex"
                        @mousedown="handleMouseDown($event, row.rowMeta.rowIndex, colIndex)"
                        @mouseover="handleMouseOver($event, row.rowMeta.rowIndex, colIndex)"
                        @click="handleCellClick($event, row.rowMeta.rowIndex, colIndex)"
                        @dblclick="makeEditable(row, columnObj)"
                        @contextmenu="showContextMenu($event, { row: row.rowMeta.rowIndex, col: colIndex })"
                      >
                        <div v-if="!switchingTab" class="w-full">
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
                    </tr>
                  </template>
                </LazySmartsheetRow>
                <tr
                  v-if="isAddingEmptyRowAllowed"
                  v-e="['c:row:add:grid-bottom']"
                  class="text-left nc-grid-add-new-cell mb-64 transition-all cursor-pointer group relative z-3 xs:hidden"
                  :class="{
                    '!border-r-2 !border-r-gray-100': visibleColLength === 1,
                  }"
                  :style="{
                    height: '32px',
                    left: `-${leftOffset}px`,
                  }"
                  @mouseup.stop
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
              :class="
                (!selectedRange.isEmpty() && selectedRange.end.col !== 0) || (selectedRange.isEmpty() && activeCell.col !== 0)
                  ? 'z-3'
                  : 'z-4'
              "
              :style="{
                top: `${fillHandleTop}px`,
                left: `${fillHandleLeft}px`,
                cursor: 'crosshair',
              }"
            />
          </div>
        </div>

        <template #overlay>
          <NcMenu class="!rounded !py-0" @click="contextMenu = false">
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
              <NcDivider v-if="!(!contextMenuClosing && !contextMenuTarget && selectedRows.length)" />
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

    <div class="absolute bottom-12 left-2">
      <NcDropdown v-if="isAddingEmptyRowAllowed">
        <div class="flex">
          <NcButton
            v-if="isMobileMode"
            v-e="[isAddNewRecordGridMode ? 'c:row:add:grid' : 'c:row:add:form']"
            class="nc-grid-add-new-row"
            size="small"
            type="secondary"
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
          <NcButton v-if="!isMobileMode" size="small" class="!rounded-l-none nc-add-record-more-info" type="secondary">
            <GeneralIcon icon="arrowUp" />
          </NcButton>
        </div>

        <template #overlay>
          <NcMenu>
            <NcMenuItem v-e="['c:row:add:grid']" class="nc-new-record-with-grid group" @click="onNewRecordToGridClick">
              <div class="flex flex-row items-center justify-start gap-x-3">
                <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
                {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
              </div>

              <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
            </NcMenuItem>
            <NcMenuItem v-e="['c:row:add:form']" class="nc-new-record-with-form group" @click="onNewRecordToFormClick">
              <div class="flex flex-row items-center justify-start gap-x-3">
                <GeneralIcon class="h-4.5 w-4.5" icon="article" />
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

<style scoped lang="scss">
.nc-grid-wrapper {
  @apply h-full w-full;

  .nc-grid-add-edit-column {
    @apply bg-gray-50;
  }

  .nc-grid-add-new-cell:hover td {
    @apply text-black !bg-gray-50;
  }

  td,
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

  td {
    @apply bg-white border-b;
  }

  td:not(:first-child) {
    @apply px-3;

    &.align-top {
      @apply py-2;
    }

    &.align-middle {
      @apply py-0;
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
        @apply !text-small !p-0 m-0;
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
        @apply !p-0 m-0;
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
          @apply pr-2;
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
        .ant-select-arrow {
          @apply right-[3px];
        }
      }
      .ant-select-selection-search-input {
        @apply !h-[23px];
      }
    }
  }

  table {
    background-color: var(--nc-grid-bg);

    border-collapse: separate;
    border-spacing: 0;
  }

  td {
    text-overflow: ellipsis;
  }

  td.active::after {
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
  td.active::after {
    @apply text-primary border-current bg-primary bg-opacity-5;
  }

  td.active.readonly::after {
    @apply text-primary bg-grey-50 bg-opacity-5 !border-gray-200;
  }

  td.active-cell::after {
    @apply border-1 border-solid text-primary border-current bg-primary bg-opacity-3;
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

  tbody td:not(.placeholder-column):nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 4;
    background: white;
  }

  .desktop {
    thead th:nth-child(2) {
      position: sticky !important;
      z-index: 5;
      left: 64px;
      @apply border-r-1 border-r-gray-200;
    }

    tbody tr:not(.nc-grid-add-new-cell):not(.placeholder) td:not(.placeholder-column):nth-child(2) {
      position: sticky !important;
      z-index: 4;
      left: 64px;
      background: white;
      @apply border-r-1 border-r-gray-100;
    }
  }

  .nc-grid-skeleton-loader {
    thead th:nth-child(2) {
      @apply border-r-1 !border-r-gray-50;
    }

    tbody td:not(.placeholder-column):nth-child(2) {
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
    @apply !xs:hidden w-full items-center justify-between;
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

    .nc-expand {
      @apply flex;
    }

    .nc-row-expand-and-checkbox {
      @apply !xs:hidden flex;
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
    td:nth-child(2):not(.active) {
      @apply border-b-gray-200;
    }
  }

  &:not(.active-row):has(+ .active-row),
  &:not(.mouse-down):has(+ :hover) {
    &:not(.selected-row) {
      td.nc-grid-cell:not(.active),
      td:nth-child(2):not(.active) {
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
  position: relative;
  z-index: 10000;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
