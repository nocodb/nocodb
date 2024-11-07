<script setup lang="ts">
import {
  type ColumnReqType,
  type ColumnType,
  type TableType,
  UITypes,
  type ViewType,
  ViewTypes,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'

import { useColumnDrag } from './useColumnDrag'
import { type CellRange, NavigateDir, type Row } from '#imports'

const props = defineProps<{
  totalRows: number
  data: Record<number, Row>
  rowHeight?: number
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
} = props

// Temp Below

const switchingTab = ref(false)

/// Temp TOp

const { $e } = useNuxtApp()

const VIRTUAL_MARGIN = 5

const { paste } = usePaste()

const isView = false

const bufferSize = 100

const { isMobileMode, isAddNewRecordGridMode, setAddNewRecordGridMode } = useGlobal()

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const { addLTARRef, syncLTARRefs, clearLTARCell, cleaMMCell } = useSmartsheetLtarHelpersOrThrow()

// Table Meta
const meta = inject(MetaInj, ref())

const fields = inject(FieldsInj, ref([]))

const view = inject(ActiveViewInj, ref())

// Is the view is Locked
const isLocked = inject(IsLockedInj, ref(false))

const isPublicView = inject(IsPublicInj, ref(false))

// Readonly Mode. If true, user can't edit the data
const readOnly = inject(ReadonlyInj, ref(false))

const { loadViewAggregate } = useViewAggregateOrThrow()

const {
  predictingNextColumn,
  predictedNextColumn,
  predictingNextFormulas,
  predictedNextFormulas,
  predictNextColumn,
  predictNextFormulas,
} = useNocoEe().table

const { isPkAvail, isSqlView, eventBus } = useSmartsheetStoreOrThrow()

const {
  isViewColumnsLoading: _isViewColumnsLoading,
  updateGridViewColumn,
  gridViewCols,
  metaColumnById,
  resizingColOldWith,
} = useViewColumnsOrThrow()

// Dummy data used for loading skeleton
const dummyColumnDataForLoading = computed(() => {
  let length = fields.value?.length ?? 40
  length = length || 40
  return Array.from({ length: length + 1 }).map(() => ({}))
})

// Temporary column meta. Data is stored in the order of fields
// Stores if it is a virtual column and if it is readonly
const colMeta = computed(() => {
  return fields.value.map((col) => {
    return {
      isVirtualCol: isVirtualCol(col),
      isReadonly: isReadonly(col),
    }
  })
})

// Set to true if view columns are loading or the meta is not available
const isViewColumnsLoading = computed(() => _isViewColumnsLoading.value || !meta.value)

// Set to true if user is resizing a column
const resizingColumn = ref(false)

// Max and Minimum width for each column type
// If the limit it not set, user can resize the column to any width
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

// Applies the width limit to the column
const normalizedWidth = (col: ColumnType, width: number) => {
  if (col.uidt! in columnWidthLimit) {
    const { minWidth, maxWidth } = columnWidthLimit[col.uidt]

    if (minWidth < width && width < maxWidth) return width
    if (width < minWidth) return minWidth
    if (width > maxWidth) return maxWidth
  }
  return width
}

// Helper functions for resizing columns
const onresize = (colID: string | undefined, event: any) => {
  if (!colID) return
  const size = event.detail.split('px')[0]

  updateGridViewColumn(colID, { width: `${normalizedWidth(metaColumnById.value[colID], size)}px` })
}

const onXcResizing = (cn: string | undefined, event: any) => {
  if (!cn) return
  const size = event.detail.split('px')[0]
  gridViewCols.value[cn].width = `${normalizedWidth(metaColumnById.value[cn], size)}px`
}

const onXcStartResizing = (cn: string | undefined, event: any) => {
  if (!cn) return
  resizingColOldWith.value = event.detail
  resizingColumn.value = true
}

// Ref of the table body element
const tableBodyEl = ref<HTMLElement>()

// Ref of the grid wrapper element
const gridWrapper = ref<HTMLElement>()

// Scroll wrapper can be either the gridWrapper or the injected scrollWrapper
// Right now, only gridWrapper is used
const scrollWrapper = computed(() => gridWrapper.value)

// Helper functions for column drag
const { onDrag, onDragStart, onDragEnd, draggedCol, dragColPlaceholderDomRef, toBeDroppedColId } = useColumnDrag({
  fields,
  tableBodyEl,
  gridWrapper,
})

// Used to calculate the column slices when the grid is scrolled horizontally
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

// The rows that are fetched from the server are stored in the cache
// This is to avoid fetching the same rows again when the user scrolls

const totalRows = toRef(props, 'totalRows')

const cachedLocalRows = toRef(props, 'data')

const visibleRows = ref<Array<Row>>()

const scrollTop = ref(0)

const colSlice = ref({
  start: 0,
  end: 0,
})

const rowSlice = reactive({
  start: 0,
  end: 0,
})

// Flag to prevent multiple updates
const isUpdating = ref(false)

const updateVisibleItems = async (newScrollTop: number, force = false) => {
  // If we are already updating the visibleItems, skip
  if (!force && isUpdating.value) {
    return
  }

  isUpdating.value = true

  // Calculate the start and end index of the visible items
  // Add a buffer to top and bottom to make the elements load before they are visible
  const startIndex = Math.max(0, Math.floor(newScrollTop / rowHeightInPx[`${props.rowHeight}`]))
  const visibleCount = Math.ceil(scrollWrapper.value.clientHeight / rowHeightInPx[`${props.rowHeight}`])
  const endIndex = Math.min(startIndex + visibleCount + bufferSize, totalRows.value)

  if (startIndex === rowSlice.start && endIndex === rowSlice.end && !force) {
    isUpdating.value = false
    return
  }

  rowSlice.start = startIndex
  rowSlice.end = endIndex

  // Determine which items we need to fetch
  // If the item is not in the cache, we need to fetch it
  const itemsToFetch = []

  const newVisibleRows = []

  for (let i = startIndex; i < endIndex; i++) {
    if (cachedLocalRows.value[i]) {
      newVisibleRows.push(cachedLocalRows.value[i])
    } else {
      itemsToFetch.push(i)
      newVisibleRows.push({ row: {}, oldRow: {}, rowMeta: { rowIndex: i, loading: true, selected: false } })
    }
  }

  visibleRows.value = newVisibleRows

  if (itemsToFetch.length > 0) {
    try {
      const newItems = await loadData({
        offset: itemsToFetch[0],
        limit: itemsToFetch[itemsToFetch.length - 1] + 1 - itemsToFetch[0],
      })

      newItems.forEach((item) => {
        cachedLocalRows.value[item.rowMeta.rowIndex!] = item
        const index = item.rowMeta.rowIndex! - startIndex
        if (index >= 0 && index < newVisibleRows.length) {
          newVisibleRows[index] = item
        }
      })

      visibleRows.value = newVisibleRows

      clearCache(startIndex, endIndex)
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  await nextTick(() => {
    isUpdating.value = false
  })
}

const debouncedUpdateVisibleItems = useDebounceFn(updateVisibleItems, 16)

const startRowHeight = computed(() => `${rowSlice.start * rowHeightInPx[`${props.rowHeight}`]}px`)
const endRowHeight = computed(() => `${Math.max(0, (totalRows.value - rowSlice.end) * rowHeightInPx[`${props.rowHeight}`])}px`)

const calculateSlices = () => {
  // if the grid is not rendered yet
  if (!scrollWrapper.value || !gridWrapper.value) {
    colSlice.value = {
      start: 0,
      end: 0,
    }

    // try again until the grid is rendered
    setTimeout(calculateSlices, 100)
    return
  }

  let renderStart = 0

  // use binary search to find the start and end columns
  let startRange = 0
  let endRange = colPositions.value.length - 1

  while (endRange !== startRange) {
    const middle = Math.floor((endRange - startRange) / 2 + startRange)

    if (
      colPositions.value[middle] <= scrollWrapper.value.scrollLeft &&
      colPositions.value[middle + 1] > scrollWrapper.value.scrollLeft
    ) {
      renderStart = middle
      break
    }

    if (middle === startRange) {
      renderStart = endRange
      break
    } else {
      if (colPositions.value[middle] <= scrollWrapper.value.scrollLeft) {
        startRange = middle
      } else {
        endRange = middle
      }
    }
  }

  let renderEnd = 0
  let renderEndFound = false

  for (let i = renderStart; i < colPositions.value.length; i++) {
    if (colPositions.value[i] > gridWrapper.value.clientWidth + scrollWrapper.value.scrollLeft) {
      renderEnd = i
      renderEndFound = true
      break
    }
  }

  colSlice.value = {
    start: Math.max(0, renderStart - VIRTUAL_MARGIN),
    end: renderEndFound ? Math.min(fields.value.length, renderEnd + VIRTUAL_MARGIN) : fields.value.length,
  }
}

const cellMeta = computed(() => {
  return visibleRows.value?.map((row) => {
    return fields.value.map((col) => {
      return {
        isColumnRequiredAndNull: isColumnRequiredAndNull(col, row.row),
      }
    })
  })
})

const expandAndLooseFocus = (row: Row, col: Record<string, any>) => {
  if (expandForm) {
    expandForm(row, col)
  }
  // TODO: Implement focus
  /* activeCell.row = null
  activeCell.col = null
  selectedRange.clear() */
}

// Only the visible fields are shown in the grid
// This is to optimize the performance when large number of columns are present
const visibleFields = computed(() => {
  // return data as { field, index } to keep track of the index
  const vFields = fields.value.slice(colSlice.value.start, colSlice.value.end)
  return vFields.map((field, index) => ({ field, index: index + colSlice.value.start })).filter((f) => f.index !== 0)
})

// Scroll Left is used to apply scroll to the aggregation bar when the grid is scrolled
const scrollLeft = ref(0)

const animationFrames = ref()

useScroll(scrollWrapper, {
  onScroll: (e) => {
    scrollLeft.value = e.target?.scrollLeft
    scrollTop.value = e.target?.scrollTop
    if (animationFrames.value) {
      cancelAnimationFrame(animationFrames.value)
    }
    animationFrames.value = requestAnimationFrame(() => {
      calculateSlices()
      debouncedUpdateVisibleItems(scrollTop.value)
      // refreshFillHandle()
    })
  },
  behavior: 'auto',
})

// Check
const { isUIAllowed, isDataReadOnly } = useRoles()
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))
const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('fieldAdd') && !isSqlView.value)

onMounted(async () => {
  await syncCount()

  until(scrollWrapper)
    .toBeTruthy()
    .then(async () => {
      calculateSlices()
      await Promise.allSettled([loadViewAggregate(), updateVisibleItems(scrollTop.value)])
    })
})

const selectColumn = (colId: string) => {
  // TODO: Implement column selection
  /* if (draggedCol) {
    updateGridViewColumn(draggedCol.id!, { show: true })
    updateGridViewColumn(colId, { show: false })
    draggedCol = null
  } */
}

// Add new Column

const addColumnDropdown = ref(false)

const editOrAddProviderRef = ref()

const altModifier = ref(false)

const persistMenu = ref(false)

const preloadColumn = ref<any>()

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const isJsonExpand = ref(false)
provide(JsonExpandInj, isJsonExpand)

function openColumnCreate(data: any) {
  scrollToAddNewColumnHeader('smooth')

  setTimeout(() => {
    addColumnDropdown.value = true
    preloadColumn.value = data
  }, 500)
}

const loadColumn = (title: string, tp: string, colOptions?: any) => {
  preloadColumn.value = {
    title,
    uidt: tp,
    colOptions,
  }
  persistMenu.value = false
}

const closeAddColumnDropdown = (scrollToLastCol = false) => {
  columnOrder.value = null
  addColumnDropdown.value = false
  preloadColumn.value = {}
  if (scrollToLastCol) {
    setTimeout(() => {
      scrollToAddNewColumnHeader('smooth')
    }, 200)
  }
}

function scrollToAddNewColumnHeader(behavior: ScrollOptions['behavior']) {
  if (scrollWrapper.value) {
    scrollWrapper.value?.scrollTo({
      top: scrollWrapper.value.scrollTop,
      left: scrollWrapper.value.scrollWidth,
      behavior,
    })
  }
}

const onVisibilityChange = () => {
  addColumnDropdown.value = true
  if (!editOrAddProviderRef.value?.isWebHookModalOpen()) {
    addColumnDropdown.value = false
  }
}

// Listeners
eventBus.on(async (event, payload) => {
  if (event === SmartsheetStoreEvents.FIELD_ADD) {
    columnOrder.value = payload
    addColumnDropdown.value = true
  }
  if (event === SmartsheetStoreEvents.CLEAR_NEW_ROW) {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null
    // TODO: Implement this
    // removeRowIfNew?.(payload)
  }
})

// Helper functions for placeholder rendering
const parsePixelValue = (value: string): number => {
  return +value.replace('px', '') || 0
}

// Compute cumulative widths for each column
const cumulativeWidths = computed(() => {
  let sum = 0

  return fields.value.map(({ id }) => {
    const width = parsePixelValue(gridViewCols[id]?.width || '200px')
    sum += width + 16 + 1
    return sum
  })
})

// Add new Records

const tableHeadEl = ref<HTMLElement>()

const { height: tableHeadHeight, width: _tableHeadWidth } = useElementBounding(tableHeadEl)

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

  const numColWidth = container.querySelector('thead th:nth-child(1)')?.getBoundingClientRect().width ?? 0
  const primaryColWidth = container.querySelector('thead th:nth-child(2)')?.getBoundingClientRect().width ?? 0

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

/// Start of useMultiSelect

const editEnabled = ref(false)

const isKeyDown = ref(false)

const fillHandle = ref<HTMLElement>()

// #Context Menu
const _contextMenu = ref(false)
const contextMenu = computed({
  get: () => {
    // TODO: implement a wrapper co,puted property to getOnly the selectedRows
    // if (props.data?.some((r) => r.rowMeta.selected) && isDataReadOnly.value) return false
    return _contextMenu.value
  },
  set: (val) => {
    _contextMenu.value = val
  },
})
const contextMenuClosing = ref(false)
const contextMenuTarget = ref<{ row: number; col: number } | null>(null)

const isAddingEmptyRowAllowed = computed(() => !isView && hasEditPermission.value && !isSqlView.value && !isPublicView.value)

const showContextMenu = (e: MouseEvent, target?: { row: number; col: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const isGridCellMouseDown = ref(false)

function makeEditable(row: Row, col: ColumnType) {
  if (!hasEditPermission.value || editEnabled.value || isView || readOnly.value || isSystemColumn(col)) {
    return
  }

  if (!isPkAvail.value && !row.rowMeta.new) {
    // Update not allowed for table which doesn't have primary Key
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

async function clearCell(ctx: { row: number; col: number } | null, skipUpdate = false) {
  if (
    isDataReadOnly.value ||
    !ctx ||
    !hasEditPermission.value ||
    (!isLinksOrLTAR(fields.value[ctx.col]) && isVirtualCol(fields.value[ctx.col]))
  )
    return

  if (colMeta.value[ctx.col].isReadonly) return

  // TODO: Get the data from the localRowCache
  const rowObj = cachedLocalRows.value[ctx.row]
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
          const rowObj = cachedLocalRows.value[ctx.row]
          const columnObj = fields.value[ctx.col]
          if (
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
          const rowObj = cachedLocalRows.value[ctx.row]
          const columnObj = fields.value[ctx.col]
          if (rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) && columnObj.id === col.id) {
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
  cachedLocalRows,
  editEnabled,
  isPkAvail,
  contextMenu,
  clearCell,
  clearSelectedRangeOfCells,
  makeEditable,
  scrollToCell,
  async (e: KeyboardEvent) => {
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
        const row = cachedLocalRows.value[activeCell.row]
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
          scrollToCell?.()
          editEnabled.value = false
          return true
        case 'ArrowDown':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = totalRows.value - 1
          activeCell.col = activeCell.col ?? 0
          scrollToCell?.()
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
            scrollToAddNewColumnHeader(undefined)

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
    const rowObj = cachedLocalRows.value[ctx.row]
    const columnObj = ctx.col !== undefined ? fields.value[ctx.col] : null

    if (!rowObj || !columnObj) {
      return
    }

    if (!ctx.updatedColumnTitle && isVirtualCol(columnObj)) {
      return
    }

    // See DateTimePicker.vue for details
    cachedLocalRows.value[ctx.row].rowMeta.isUpdatedFromCopyNPaste = {
      ...cachedLocalRows.value[ctx.row].rowMeta.isUpdatedFromCopyNPaste,
      [(ctx.updatedColumnTitle || columnObj.title) as string]: true,
    }

    // update/save cell value
    await updateOrSaveRow?.(rowObj, ctx.updatedColumnTitle || columnObj.title)
  },
  bulkUpdateRows,
  fillHandle,
  view,
)

async function clearSelectedRangeOfCells() {
  if (!hasEditPermission.value || isDataReadOnly.value) return

  const start = selectedRange.start
  const end = selectedRange.end

  const startCol = Math.min(start.col, end.col)
  const endCol = Math.max(start.col, end.col)

  const cols = fields.value.slice(startCol, endCol + 1)
  const rows = visibleRows.value
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

const deleteSelectedRangeOfRows = () => {
  deleteRangeOfRows?.(selectedRange).then(() => {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null
  })
}

const confirmDeleteRow = (row: number) => {
  try {
    deleteRow?.(row)

    if (selectedRange.isRowInRange(row)) {
      clearSelectedRange()
    }

    if (activeCell.row === row) {
      activeCell.row = null
      activeCell.col = null
    }
  } catch (e: any) {
    message.error(e.message)
  }
}

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const commentRow = (rowId: number) => {
  try {
    isExpandedFormCommentMode.value = true

    const row = cachedLocalRows.value[rowId]
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

const selectedReadonly = computed(
  () =>
    // if all the selected columns are not readonly
    (selectedRange.isEmpty() && activeCell.col && colMeta.value[activeCell.col].isReadonly) ||
    (!selectedRange.isEmpty() &&
      Array.from({ length: selectedRange.end.col - selectedRange.start.col + 1 }).every(
        (_, i) => colMeta.value[selectedRange.start.col + i].isReadonly,
      )),
)

/// End of useMultiSelect

function scrollToCell(row?: number | null, col?: number | null) {
  row = activeCell.row
  col = activeCell.col

  if (row !== null && col !== null && scrollWrapper.value) {
    // calculate cell position
    const td = {
      top: row * rowHeightInPx[`${props.rowHeight}`],
      left: colPositions.value[col],
      right:
        col === fields.value.length - 1 ? colPositions.value[colPositions.value.length - 1] + 200 : colPositions.value[col + 1],
      bottom: (row + 1) * rowHeightInPx[`${props.rowHeight}`],
    }

    const tdScroll = getContainerScrollForElement(td, scrollWrapper.value, {
      top: 9,
      bottom: (tableHeadHeight.value || 40) + 9,
      right: 9,
    })

    // if first column set left to 0 since it's sticky it will be visible and calculated value will be wrong
    // setting left to 0 will make it scroll to the left
    if (col === 0) {
      tdScroll.left = 0
    }

    if (row === totalRows.value - 1) {
      scrollWrapper.value.scrollTo({
        top: scrollWrapper.value.scrollHeight,
        left:
          col === fields.value.length - 1 // if corner cell
            ? scrollWrapper.value.scrollWidth
            : tdScroll.left,
        behavior: 'smooth',
      })
      return
    }

    if (col === fields.value.length - 1) {
      // if last column make 'Add New Column' visible
      scrollWrapper.value.scrollTo({
        top: tdScroll.top,
        left: scrollWrapper.value.scrollWidth,
        behavior: 'smooth',
      })
      return
    }

    // scroll into the active cell
    scrollWrapper.value.scrollTo({
      top: tdScroll.top,
      left: tdScroll.left,
      behavior: 'smooth',
    })
  }
}

const handleCellClick = (event: MouseEvent, row: number, col: number) => {
  const rowData = cachedLocalRows.value[row]

  if (isMobileMode.value) {
    return expandAndLooseFocus(rowData, fields.value[col])
  }

  _handleCellClick(event, row, col)
}

function scrollToRow(row?: number) {
  clearSelectedRange()
  makeActive(row ?? totalRows.value - 1, 0)
  selectedRange.startRange({ row: activeCell.row!, col: activeCell.col! })
  scrollToCell?.()
}

async function openNewRecordHandler() {
  const newRow = addEmptyRow(totalRows.value + 1, true)
  if (newRow) expandForm?.(newRow, undefined, true)
}

const onDraftRecordClick = () => {
  openNewRecordFormHook.trigger()
}

async function saveEmptyRow(rowObj: Row) {
  await updateOrSaveRow?.(rowObj)
}

function addEmptyRow(row?: number, skipUpdate: boolean = false) {
  const rowObj = callAddEmptyRow?.(row)

  if (!skipUpdate && rowObj) {
    saveEmptyRow(rowObj)
  }

  updateVisibleItems(scrollTop.value, true)

  nextTick().then(() => {
    scrollToRow(row ?? totalRows.value + 1)
  })
  return rowObj
}

const onNewRecordToGridClick = () => {
  setAddNewRecordGridMode(true)
  addEmptyRow()
}

const onNewRecordToFormClick = () => {
  setAddNewRecordGridMode(false)
  onDraftRecordClick()
}

openNewRecordFormHook?.on(openNewRecordHandler)

const scrolling = ref(false)

const disableUrlOverlay = ref(false)

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

/** handle keypress events */
useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const isRichModalOpen = isExpandedCellInputExist()

  if (e.key === 'Alt' && !isRichModalOpen) {
    altModifier.value = true
  }
})

/** handle keypress events */
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

reloadViewDataHook?.on(async () => {
  await syncCount()
  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
  visibleRows.value = []
  await updateVisibleItems(0, true)
})

defineExpose({
  scrollToRow: () => {},
  openColumnCreate,
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
    <NcDropdown
      v-model:visible="contextMenu"
      :trigger="isSqlView ? [] : ['contextmenu']"
      overlay-class-name="nc-dropdown-grid-context-menu"
    >
      <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 relative nc-scrollbar-x-lg !overflow-auto">
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
                v-for="(col, colIndex) of dummyColumnDataForLoading"
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
            <tr v-else class="nc-grid-header">
              <th class="w-[64px] min-w-[64px]" data-testid="grid-id-column">
                <div class="w-full h-full flex pl-2 pr-1 items-center" data-testid="nc-check-all">
                  <template v-if="!readOnly">
                    <div class="nc-no-label text-gray-500">#</div>
                  </template>
                  <template v-else>
                    <div class="text-gray-500">#</div>
                  </template>
                </div>
              </th>
              <th
                v-if="fields[0] && fields[0].id"
                v-xc-ver-resize
                :data-col="fields[0].id"
                :data-title="fields[0].title"
                :style="{
                  'min-width': gridViewCols[fields[0].id]?.width || '180px',
                  'max-width': gridViewCols[fields[0].id]?.width || '180px',
                  'width': gridViewCols[fields[0].id]?.width || '180px',
                }"
                class="nc-grid-column-header column-header column"
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
                class="nc-grid-column-header column-header column"
                :class="{
                  '!border-r-blue-400 !border-r-3': toBeDroppedColId === col.id,
                }"
                @xcstartresizing="onXcStartResizing(col.id, $event)"
                @xcresize="onresize(col.id, $event)"
                @xcresizing="onXcResizing(col.id, $event)"
                @click="selectColumn(col.id!)"
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
                          @submit="closeAddColumnDropdown(true)"
                          @cancel="closeAddColumnDropdown()"
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
        <table
          ref="smartTable"
          class="xc-row-table nc-grid backgroundColorDefault pb-12 !h-auto bg-white relative"
          :class="{
            'mobile': isMobileMode,
            'desktop': !isMobileMode,
            'w-full': visibleRows?.length === 0,
          }"
        >
          <tbody ref="tableBodyEl">
            <div class="placeholder top-placeholder" :style="`height: ${startRowHeight};`">
              <div
                class="placeholder-column"
                :style="{
                  width: '63px',
                  left: '0px',
                }"
              ></div>
              <div
                v-for="({ id }, index) in fields"
                :key="id"
                class="placeholder-column px-2"
                :style="{
                  width: gridViewCols[id]?.width || '200px',
                  left: `${(cumulativeWidths[index - 1] || 0) + 64}px`,
                }"
              ></div>
            </div>
            <LazySmartsheetRow
              v-for="(row, index) in visibleRows"
              :key="`${rowSlice.start + index}-${row.rowMeta.rowIndex}-${row.rowMeta.loading}`"
              :row="row"
            >
              <template #default="{ state }">
                <tr
                  class="nc-grid-row !xs:h-14"
                  :style="{ transform: `translateY(${rowSlice.start * rowHeightInPx[`${rowHeight}`]}px)` }"
                  :data-testid="`grid-row-${index}`"
                  :class="{
                    'active-row':
                      activeCell.row === rowSlice.start + index || selectedRange._start?.row === rowSlice.start + index,
                    'mouse-down': isGridCellMouseDown || isFillMode,
                    'selected-row': row.rowMeta.selected,
                  }"
                >
                  <td
                    key="row-index"
                    class="caption nc-grid-cell w-[64px] min-w-[64px]"
                    :data-testid="`cell-Id-${rowSlice.start + index}`"
                  >
                    <div class="w-[60px] pl-2 pr-1 items-center flex gap-1">
                      <div
                        class="nc-row-no sm:min-w-4 text-xs text-gray-500"
                        :class="{ toggle: !readOnly, hidden: row.rowMeta?.selected }"
                      >
                        {{ rowSlice.start + index + 1 }}
                      </div>
                      <div
                        v-if="!readOnly"
                        :class="{
                          hidden: !row.rowMeta?.selected,
                          flex: row.rowMeta?.selected,
                        }"
                        class="nc-row-expand-and-checkbox"
                      >
                        <a-checkbox v-model:checked="row.rowMeta.selected" />
                      </div>
                      <span class="flex-1" />

                      <div
                        class="nc-expand"
                        :data-testid="`nc-expand-${rowSlice.start + index}`"
                        :class="{ 'nc-comment': row.rowMeta?.commentCount }"
                      >
                        <a-spin
                          v-if="row.rowMeta?.saving"
                          class="!flex items-center"
                          :data-testid="`row-save-spinner-${rowSlice.start + index}`"
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
                          v-else-if="!row.rowMeta?.saving"
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
                      'active': selectRangeMap[`${rowSlice.start + index}-0`],
                      'active-cell':
                        (activeCell.row === rowSlice.start + index && activeCell.col === 0) ||
                        (selectedRange._start?.row === rowSlice.start + index && selectedRange._start?.col === 0),
                      'nc-required-cell': cellMeta[index][0].isColumnRequiredAndNull && !isPublicView,
                      'align-middle': !rowHeight || rowHeight === 1,
                      'align-top': rowHeight && rowHeight !== 1,
                      'filling': fillRangeMap[`${rowSlice.start + index}-0`],
                      'readonly': colMeta[0].isReadonly && hasEditPermission && selectRangeMap[`${rowSlice.start + index}-0`],
                      '!border-r-blue-400 !border-r-3': toBeDroppedColId === fields[0].id,
                    }"
                    :style="{
                      'min-width': gridViewCols[fields[0].id]?.width || '180px',
                      'max-width': gridViewCols[fields[0].id]?.width || '180px',
                      'width': gridViewCols[fields[0].id]?.width || '180px',
                    }"
                    :data-testid="`cell-${fields[0].title}-${rowSlice.start + index}`"
                    :data-key="`data-key-${rowSlice.start + index}-${fields[0].id}`"
                    :data-col="fields[0].id"
                    :data-title="fields[0].title"
                    :data-row-index="rowSlice.start + index"
                    :data-col-index="0"
                    @mousedown="handleMouseDown($event, rowSlice.start + index, 0)"
                    @mouseover="handleMouseOver($event, rowSlice.start + index, 0)"
                    @dblclick="makeEditable(row, fields[0])"
                    @contextmenu="showContextMenu($event, { row: rowSlice.start + index, col: 0 })"
                    @click="handleCellClick($event, rowSlice.start + index, 0)"
                  >
                    <div v-if="!switchingTab" class="w-full">
                      <LazySmartsheetVirtualCell
                        v-if="fields[0] && colMeta[0].isVirtualCol && fields[0].title"
                        v-model="row.row[fields[0].title]"
                        :active="activeCell.col === 0 && activeCell.row === rowSlice.start + index"
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
                          activeCell.row === rowSlice.start + index
                        "
                        :row-index="rowSlice.start + index"
                        :active="activeCell.col === 0 && activeCell.row === rowSlice.start + index"
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
                    :key="`cell-${colIndex}-${rowSlice.start + index}`"
                    class="cell relative nc-grid-cell cursor-pointer"
                    :class="{
                      'active': selectRangeMap[`${rowSlice.start + index}-${colIndex}`],
                      'active-cell':
                        (activeCell.row === rowSlice.start + index && activeCell.col === colIndex) ||
                        (selectedRange._start?.row === rowSlice.start + index && selectedRange._start?.col === colIndex),
                      'nc-required-cell': cellMeta[index][colIndex].isColumnRequiredAndNull && !isPublicView,
                      'align-middle': !rowHeight || rowHeight === 1,
                      'align-top': rowHeight && rowHeight !== 1,
                      'filling': fillRangeMap[`${rowSlice.start + index}-${colIndex}`],
                      'readonly':
                        colMeta[colIndex].isReadonly &&
                        hasEditPermission &&
                        selectRangeMap[`${rowSlice.start + index}-${colIndex}`],
                      '!border-r-blue-400 !border-r-3': toBeDroppedColId === columnObj.id,
                    }"
                    :style="{
                      'min-width': gridViewCols[columnObj.id]?.width || '180px',
                      'max-width': gridViewCols[columnObj.id]?.width || '180px',
                      'width': gridViewCols[columnObj.id]?.width || '180px',
                    }"
                    :data-testid="`cell-${columnObj.title}-${rowSlice.start + index}`"
                    :data-key="`data-key-${rowSlice.start + index}-${columnObj.id}`"
                    :data-col="columnObj.id"
                    :data-title="columnObj.title"
                    :data-row-index="rowSlice.start + index"
                    :data-col-index="colIndex"
                    @mousedown="handleMouseDown($event, rowSlice.start + index, colIndex)"
                    @mouseover="handleMouseOver($event, rowSlice.start + index, colIndex)"
                    @click="handleCellClick($event, rowSlice.start + index, colIndex)"
                    @dblclick="makeEditable(row, columnObj)"
                    @contextmenu="showContextMenu($event, { row: rowSlice.start + index, col: colIndex })"
                  >
                    <div v-if="!switchingTab" class="w-full">
                      <LazySmartsheetVirtualCell
                        v-if="colMeta[colIndex].isVirtualCol && columnObj.title"
                        v-model="row.row[columnObj.title]"
                        :column="columnObj"
                        :row="row"
                        :active="activeCell.col === colIndex && activeCell.row === rowIndex"
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
                          activeCell.row === rowSlice.start + index
                        "
                        :active="activeCell.col === colIndex && activeCell.row === rowSlice.start + index"
                        :read-only="!hasEditPermission"
                        :column="columnObj"
                        :row-index="rowSlice.start + index"
                        @save="updateOrSaveRow?.(row, columnObj.title, state)"
                        @navigate="onNavigate"
                        @cancel="editEnabled = false"
                      />
                    </div>
                  </SmartsheetTableDataCell>
                </tr>
              </template>
            </LazySmartsheetRow>
            <div
              class="placeholder relative bottom-placeholder"
              :style="`height: ${endRowHeight}; top: ${rowSlice.end * rowHeightInPx[`${props.rowHeight}`]}px;`"
            >
              <div
                class="placeholder-column"
                :style="{
                  width: '63px',
                  left: '0px',
                }"
              ></div>
              <div
                v-for="({ id }, index) in fields"
                :key="id"
                class="placeholder-column px-2"
                :style="{
                  width: gridViewCols[id]?.width || '200px',
                  left: `${(cumulativeWidths[index - 1] || 0) + 64}px`,
                }"
              ></div>
            </div>
          </tbody>
        </table>
      </div>

      <template #overlay>
        <NcMenu class="!rounded !py-0" @click="contextMenu = false">
          <!--
          //data.some((r) => r.rowMeta.selected)
-->
          <NcMenuItem
            v-if="isEeUI && !contextMenuClosing && !contextMenuTarget && !isDataReadOnly"
            @click="emits('bulkUpdateDlg')"
          >
            <div v-e="['a:row:update-bulk']" class="flex gap-2 items-center">
              <component :is="iconMap.ncEdit" />
              {{ $t('title.updateSelectedRows') }}
            </div>
          </NcMenuItem>

          <!--
//data.some((r) => r.rowMeta.selected)" -->
          <NcMenuItem
            v-if="!contextMenuClosing && !contextMenuTarget && !isDataReadOnly"
            class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
            data-testid="nc-delete-row"
            @click="deleteSelectedRows"
          >
            <!--
            // TODO: IF selectedRows.lenght = 1
-->

            <div v-if="true" v-e="['a:row:delete']" class="flex gap-2 items-center">
              <component :is="iconMap.delete" />
              <!-- Delete Selected Rows -->
              {{ $t('activity.deleteSelectedRow') }}
            </div>
            <div v-else v-e="['a:row:delete-bulk']" class="flex gap-2 items-center">
              <component :is="iconMap.delete" />
              <!-- Delete Selected Rows -->
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
            <!--
            data.some((r) => r.rowMeta.selected))
-->
            <NcDivider v-if="!(!contextMenuClosing && !contextMenuTarget)" />
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

  tbody td:nth-child(1) {
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

    tbody tr:not(.nc-grid-add-new-cell) td:nth-child(2) {
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

    tbody td:nth-child(2) {
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
