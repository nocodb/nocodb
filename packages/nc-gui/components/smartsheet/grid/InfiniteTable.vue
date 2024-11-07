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
import Table from './Table.vue'
import { type CellRange, NavigateDir, type Row } from '#imports'

const props = defineProps<{
  totalRows: number
  data: Record<number, Row>
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
} = props

// $e is a helper function to emit telemetry events
const { $e } = useNuxtApp()

const { api } = useApi()

const VIRTUAL_MARGIN = 10

const switchingTab = ref(false)

// Helper composable to handle paste from the clipboard
const { paste } = usePaste()

// getMeta - function to get the table and
// metas - reactive ref of the table metas
const { getMeta } = useMetas()

// Number of additional rows to be fetched when the user scrolls
// Buffer is applied on both start and end
const bufferSize = 100

// Global states
// isMobileMode - reactive ref to check if the viewports is mobile
// isAddNewRecordGridMode - reactive ref. contains whether to show createRow with form or grid
// setAddNewRecordGridMode - function to set the value of isAddNewRecordGridMode
const { isMobileMode, isAddNewRecordGridMode, setAddNewRecordGridMode } = useGlobal()

// Event hook to fire when a new record via form is clicked
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

// get the current route
const route = useRoute()

// Event hook to fire when a viewMeta is updated
// When fired, should clear all localCache and reload Data
const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

// Link To Another Record/Links Helper methods
const { addLTARRef, syncLTARRefs, clearLTARCell, cleaMMCell } = useSmartsheetLtarHelpersOrThrow()

// Meta Information of the active Table
const meta = inject(MetaInj, ref())

// Fields of the active Table
const fields = inject(FieldsInj, ref([]))

// View Meta of the active View
const view = inject(ActiveViewInj, ref())

// Is the view is Locked
const isLocked = inject(IsLockedInj, ref(false))

// Is the view is Public
const isPublicView = inject(IsPublicInj, ref(false))

// Readonly Mode. If true, user can't edit the data
const readOnly = inject(ReadonlyInj, ref(false))

// addUndo - function to add an undo action
// clone - function to clone an object
// defineViewScope - function to define the scope of the undo action
const { addUndo, clone, defineViewScope } = useUndoRedo()

// function to trigger the aggregation api
const { loadViewAggregate } = useViewAggregateOrThrow()

const {
  predictingNextColumn,
  predictedNextColumn,
  predictingNextFormulas,
  predictedNextFormulas,
  predictNextColumn,
  predictNextFormulas,
} = useNocoEe().table

// isReadOnly - Helper function to check if the column is readonly
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

// isPkAvail - reactive ref to check if the table has primary key
// isSqlView - reactive ref to check if the view is SQL view
// eventBus - event bus to listen to events
const { isPkAvail, isSqlView, eventBus } = useSmartsheetStoreOrThrow()

// selectedRows - reactive ref to get the selected rows
const selectedRows = toRef(props, 'selectedRows')

// isViewColumnsLoading - reactive ref to check if the view columns are loading
// updateGridViewColumn - function to update the grid view column
// gridViewCols - reactive ref to get the grid view columns
// metaColumnById - reactive ref to get the meta column by id
// resizingColOldWith - reactive ref to get the old width of the column being resized
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

// The number of visible colummns
const visibleColLength = computed(() => fields.value?.length)

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

// onResize is called when the user has resized a column
// It updates the column width in the grid view
const onresize = (colID: string | undefined, event: any) => {
  if (!colID) return
  const size = event.detail.split('px')[0]

  updateGridViewColumn(colID, { width: `${normalizedWidth(metaColumnById.value[colID], size)}px` })
}

// onXcResizing is called when the user is resizing a column
const onXcResizing = (cn: string | undefined, event: any) => {
  if (!cn) return
  const size = event.detail.split('px')[0]
  gridViewCols.value[cn].width = `${normalizedWidth(metaColumnById.value[cn], size)}px`
}

// onXcStartResizing is called when the user starts resizing a column
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
// onDrag - called when the user is dragging a column
// onDragStart - called when the user starts dragging a column
// onDragEnd - called when the user stops dragging a column
// draggedCol - the column that is being dragged
// dragColPlaceholderDomRef - the dom element that is used as a placeholder when the user is dragging a column
// toBeDroppedColId - the column id where the dragged column will be dropped
const { onDrag, onDragStart, onDragEnd, draggedCol, dragColPlaceholderDomRef, toBeDroppedColId } = useColumnDrag({
  fields, // fields are the columns of the table
  tableBodyEl, // tableBodyEl is the ref of the table body element
  gridWrapper, // gridWrapper is the ref of the grid wrapper element
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

// Total number of rows in the table
const totalRows = toRef(props, 'totalRows')

// calculatedRowHeight

const rowHeight = computed(() => rowHeightInPx[`${props.rowHeightEnum}`])

// Reactive ref to the store of cached local rows
const cachedLocalRows = toRef(props, 'data')

// Visible rows in the grid They are updated when the user scrolls
const visibleRows = ref<Array<Row>>()

// Scroll top of the grid
const scrollTop = ref(0)

// Column slice is used to determine which columns are visible
const colSlice = ref({
  start: 0,
  end: 0,
})

// Row slice is used to determine which rows are visible
const rowSlice = reactive({
  start: 0,
  end: 0,
})

// Flag to prevent multiple updates
const isUpdating = ref(false)

// Update the visible rows in the grid

const updateVisibleItems = async (newScrollTop: number, force = false) => {
  // If we are already updating the visibleItems, skip
  if (!force && isUpdating.value) return

  isUpdating.value = true

  // Calculate the start and end index of the visible items
  // Add a buffer to top and bottom to make the elements load before they are visible
  const startIndex = Math.max(0, Math.floor(newScrollTop / rowHeight.value - bufferSize))
  const visibleCount = Math.ceil(scrollWrapper.value.clientHeight / rowHeight.value)
  const endIndex = Math.min(startIndex + visibleCount + bufferSize, totalRows.value)

  // If the start and end index are the same as the previous slice, skip except if force is true
  if (startIndex === rowSlice.start && endIndex === rowSlice.end && !force) {
    isUpdating.value = false
    return
  }

  rowSlice.start = startIndex
  rowSlice.end = endIndex

  const itemsToFetch: number[] = []
  const newVisibleRows: Array<Row> = []

  // Determine which items we need to fetch
  // If the item is not in the cache, we need to fetch it
  for (let i = startIndex; i < endIndex; i++) {
    if (i in cachedLocalRows.value) {
      // If the item is in the cache, use it
      newVisibleRows.push(cachedLocalRows.value[i])
    } else {
      // If the item is not in the cache, add it to the itemsToFetch
      // For temporary, we will show a loading skeleton
      itemsToFetch.push(i)
      newVisibleRows.push({ row: {}, oldRow: {}, rowMeta: { rowIndex: i, loading: true } })
    }
  }

  visibleRows.value = newVisibleRows

  // Fetch the items that are not in the cache
  if (itemsToFetch.length > 0) {
    try {
      const newItems = await loadData({
        offset: itemsToFetch[0],
        limit: itemsToFetch[itemsToFetch.length - 1] - itemsToFetch[0] + 1,
      })

      newItems.forEach((item) => {
        const index = item.rowMeta.rowIndex! - startIndex
        cachedLocalRows.value[item.rowMeta.rowIndex!] = item
        if (index >= 0 && index < newVisibleRows.length) {
          newVisibleRows[index] = item
        }
      })

      visibleRows.value = newVisibleRows
      // Update the visible items
      updateVisibleItems(newScrollTop, true)

      // Clear the cache with a buffer
      clearCache(startIndex - bufferSize, endIndex + bufferSize)
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  await nextTick(() => {
    isUpdating.value = false
  })
}

// Debounce the updateVisibleItems function to prevent multiple updates
const debouncedUpdateVisibleItems = useDebounceFn(updateVisibleItems, 16)

// The height of placeholder rows before the visible rows
const startRowHeight = computed(() => `${rowSlice.start * rowHeight.value}px`)
// The height of placeholder rows after the visible rows
const endRowHeight = computed(() => `${Math.max(0, (totalRows.value - rowSlice.end) * rowHeight.value)}px`)

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

// Calculate if the cell is required and null
const cellMeta = computed(() => {
  return visibleRows.value?.map((row) => {
    return fields.value.map((col) => {
      return {
        isColumnRequiredAndNull: isColumnRequiredAndNull(col, row.row),
      }
    })
  })
})

// Only the visible fields are shown in the grid
// This is to optimize the performance when large number of columns are present
const visibleFields = computed(() => {
  // return data as { field, index } to keep track of the index
  const vFields = fields.value.slice(colSlice.value.start, colSlice.value.end)
  return vFields.map((field, index) => ({ field, index: index + colSlice.value.start })).filter((f) => f.index !== 0)
})

// Scroll Left is used to apply scroll to the aggregation bar when the grid is scrolled
const scrollLeft = ref(0)

// Check permissions
const { isUIAllowed, isDataReadOnly } = useRoles()
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))
const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('fieldAdd') && !isSqlView.value)

// addColumnDropdown - reactive ref to check if the add column dropdown is open
const addColumnDropdown = ref(false)

// editOrAddProviderRef - reactive ref to get the edit or add provider Element
const editOrAddProviderRef = ref()

// altModifier - reactive ref to check if the alt key is pressed
// Used to trigger the magic feature
const altModifier = ref(false)

const persistMenu = ref(false)

const preloadColumn = ref<any>()

// columnOrder - reactive ref to store the column order of the new column
const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

// isJsonExpand - reactive ref to check if the json expand modal is open
const isJsonExpand = ref(false)
provide(JsonExpandInj, isJsonExpand)

// openColumnCreate - function to open the column create modal
function openColumnCreate(data: any) {
  scrollToAddNewColumnHeader('smooth')

  setTimeout(() => {
    addColumnDropdown.value = true
    preloadColumn.value = data
  }, 500)
}

// loadColumn - function to preload the column. used along with magic functions
const loadColumn = (title: string, tp: string, colOptions?: any) => {
  preloadColumn.value = {
    title,
    uidt: tp,
    colOptions,
  }
  persistMenu.value = false
}

// function to close the add column dropdown
// scrollToLastCol - boolean to check if the grid should scroll to the last column
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

// scrollToAddNewColumnHeader - function to scroll to the last column
// behavior - scroll behavior
function scrollToAddNewColumnHeader(behavior: ScrollOptions['behavior']) {
  if (scrollWrapper.value) {
    scrollWrapper.value?.scrollTo({
      top: scrollWrapper.value.scrollTop,
      left: scrollWrapper.value.scrollWidth,
      behavior,
    })
  }
}

// onVisibilityChange - function to check if the add column dropdown should be closed
// Keep the dropdown open if the webhook modal is open
const onVisibilityChange = () => {
  addColumnDropdown.value = true
  if (!editOrAddProviderRef.value?.isWebHookModalOpen()) {
    addColumnDropdown.value = false
  }
}

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

// tableHeadEl - reactive ref to get the table head element
const tableHeadEl = ref<HTMLElement>()

// _tableHeadWidth - reactive ref to get the width of the table head
// tableHeadHeight - reactive ref to get the height of the table head
const { height: tableHeadHeight, width: _tableHeadWidth } = useElementBounding(tableHeadEl)

// getContainerScrollForElement - function to get the scroll position of the container
// childPos - position of the child element
// container - container element
// offset - offset to show the prev/next/up/bottom cell
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

// Is the edit Enabled in any cell
const editEnabled = ref(false)

// isKeyDown - reactive ref to check if the key is pressed
const isKeyDown = ref(false)

// _contextMenu - reactive ref to check if the context menu is open
const _contextMenu = ref(false)

// contextMenu - computed ref to check if the context menu is open
const contextMenu = computed({
  get: () => {
    if (selectedRows.value.length && isDataReadOnly.value) return false
    return _contextMenu.value
  },
  set: (val) => {
    _contextMenu.value = val
  },
})
// contextMenuClosing - reactive ref to check if the context menu is closing
const contextMenuClosing = ref(false)

// contextMenuTarget - reactive ref to get the target of the context menu
const contextMenuTarget = ref<{ row: number; col: number } | null>(null)

// showContextMenu - function to show the context menu
// e - mouse event
// target - target of the context menu
const showContextMenu = (e: MouseEvent, target?: { row: number; col: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

// isAddingEmptyRowAllowed - computed ref to check if the empty row can be added
const isAddingEmptyRowAllowed = computed(() => hasEditPermission.value && !isSqlView.value && !isPublicView.value)

// function to make the cell editable
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

// reactive ref to check if the mouse is down on the grid
// used for the fill handle
const isGridCellMouseDown = ref(false)

// clearCell - function to clear content the cell
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

const fillHandle = ref<HTMLElement>()

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

// Expand the form when the user clicks on a expand button
const expandAndLooseFocus = (row: Row, col: Record<string, any>) => {
  if (expandForm) {
    expandForm(row, col)
  }
  // remove focus from the cell
  activeCell.row = null
  activeCell.col = null
  selectedRange.clear()
}

// Select all thw cells in a column
const selectColumn = (colId: string) => {
  // this is triggered with click event, so do nothing & clear resizingColumn flag if it's true
  if (resizingColumn.value) {
    resizingColumn.value = false
    return
  }

  const colIndex = fields.value.findIndex((col) => col.id === colId)
  if (colIndex !== -1) {
    makeActive(0, colIndex)
    selectedRange.startRange({ row: 0, col: colIndex })
    selectedRange.endRange({ row: totalRows.value - 1, col: colIndex })
  }
}

// Clear the selected range
// TODO: Either remove them or handle them in useInfinite Data
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

const temporaryNewRowStore = ref<Row[]>([])

const saveOrUpdateRecords = async (
  args: { metaValue?: TableType; viewMetaValue?: ViewType; data?: any; keepNewRecords?: boolean } = {},
) => {
  for (const currentRow of args.data || Object.values(cachedLocalRows.value)) {
    if (currentRow.rowMeta.fromExpandedForm) continue

    /** if new record save row and save the LTAR cells */
    if (currentRow.rowMeta.new) {
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
    if (currentRow.rowMeta.changed) {
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

// TODO: Either remove them or handle them in useInfinite Data
const deleteSelectedRangeOfRows = () => {
  deleteRangeOfRows?.(selectedRange).then(() => {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null
  })
}

// Confirm if the user wants to delete the row
// row - the row to be deleted
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

// isExpandedFormCommentMode - reactive ref to set the expanded form comment mode is enabled
// The focus is set to the comments

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

// commentRow - function to comment the row
// rowId - the row to be commented
const commentRow = (rowId: number) => {
  try {
    // set the expanded form comment mode
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

//  onNavigate - function to navigate to the next or previous cell
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

// selectedReadonly - computed ref to check if the selected columns are readonly
const selectedReadonly = computed(
  () =>
    // if all the selected columns are not readonly
    (selectedRange.isEmpty() && activeCell.col && colMeta.value[activeCell.col].isReadonly) ||
    (!selectedRange.isEmpty() &&
      Array.from({ length: selectedRange.end.col - selectedRange.start.col + 1 }).every(
        (_, i) => colMeta.value[selectedRange.start.col + i].isReadonly,
      )),
)

// function to scroll to a cell
// row - the row to scroll to
// col - the column to scroll to
function scrollToCell(row?: number | null, col?: number | null) {
  row = activeCell.row
  col = activeCell.col

  if (row !== null && col !== null && scrollWrapper.value) {
    // calculate cell position
    const td = {
      top: row * rowHeight.value,
      left: colPositions.value[col],
      right:
        col === fields.value.length - 1 ? colPositions.value[colPositions.value.length - 1] + 200 : colPositions.value[col + 1],
      bottom: (row + 1) * rowHeight.value,
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

// handleCellClick - function to handle the cell click
const handleCellClick = (event: MouseEvent, row: number, col: number) => {
  const rowData = cachedLocalRows.value[row]

  // If isMobileMode is true, expand the form and loose focus
  if (isMobileMode.value) {
    return expandAndLooseFocus(rowData, fields.value[col])
  }

  // Else make the cell active based on conditions
  _handleCellClick(event, row, col)
}

// scrollToRow - function to scroll to a row
// row - the row to scroll to
function scrollToRow(row?: number) {
  clearSelectedRange()
  makeActive(row ?? totalRows.value - 1, 0)
  selectedRange.startRange({ row: activeCell.row!, col: activeCell.col! })
  scrollToCell?.()
}

// openNewRecordHandler - function to create a new Record in expanded form
async function openNewRecordHandler() {
  // Add an empty row
  const newRow = addEmptyRow(totalRows.value + 1, true)
  // Expand the form
  if (newRow) expandForm?.(newRow, undefined, true)
}

// onDraftRecordClick - function to create a new Record in expanded form
const onDraftRecordClick = () => {
  openNewRecordFormHook.trigger()
}

// saveEmptyRow - function to save the empty row
async function saveEmptyRow(rowObj: Row) {
  await updateOrSaveRow?.(rowObj)
}

// addEmptyRow - function to add an empty row at the end
function addEmptyRow(row?: number, skipUpdate: boolean = false) {
  const rowObj = callAddEmptyRow?.(row)

  if (!skipUpdate && rowObj) {
    saveEmptyRow(rowObj)
  }

  // on add new row, scroll to the new row
  updateVisibleItems(scrollTop.value, true)

  nextTick().then(() => {
    scrollToRow(row ?? totalRows.value - 1)
  })
  return rowObj
}

// onNewRecordToGridClick - function to add a new record from the grid
const onNewRecordToGridClick = () => {
  setAddNewRecordGridMode(true)
  addEmptyRow()
}

// onNewRecordToFormClick - function to add a new record from the expanded form
const onNewRecordToFormClick = () => {
  setAddNewRecordGridMode(false)
  onDraftRecordClick()
}

// scrolling - reactive ref to check if the user is scrolling
const scrolling = ref(false)

// on CLicked outside the tableBody
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

// leftOffset for the columns
const leftOffset = computed(() => {
  return colSlice.value.start > 0 ? colPositions.value[colSlice.value.start] - colPositions.value[1] : 0
})

// fillHandleTop - reactive ref to get the top position of the fill handle
const fillHandleTop = ref()

// fillHandleLeft - reactive ref to get the left position of the fill handle
const fillHandleLeft = ref()

// Update the fillHandle position
const refreshFillHandle = () => {
  nextTick(() => {
    const rowIndex = isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row
    const colIndex = isNaN(selectedRange.end.col) ? activeCell.col : selectedRange.end.col
    if (rowIndex !== null && colIndex !== null) {
      if (!scrollWrapper.value || !gridWrapper.value) return

      // 32 for the header
      fillHandleTop.value = (rowIndex + 1) * rowHeight.value + 32
      // 64 for the row number column
      fillHandleLeft.value =
        64 +
        colPositions.value[colIndex + 1] +
        (colIndex === 0 ? Math.max(0, scrollWrapper.value.scrollLeft - gridWrapper.value.offsetLeft) : 0)
    }
  })
}

// showFillHandle - computed ref to check if the fill handle should be shown
const showFillHandle = computed(
  () =>
    !isDataReadOnly.value &&
    !readOnly.value &&
    !editEnabled.value &&
    (!selectedRange.isEmpty() || (activeCell.row !== null && activeCell.col !== null)) &&
    !cachedLocalRows.value[(isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row) ?? -1]?.rowMeta?.new &&
    activeCell.col !== null &&
    fields.value[activeCell.col] &&
    totalRows.value &&
    !selectedReadonly.value,
)

// Update the slices and refreshHanfle positions
watch(
  [() => selectedRange.end.row, () => selectedRange.end.col, () => activeCell.row, () => activeCell.col],
  ([sr, sc, ar, ac], [osr, osc, oar, oac]) => {
    if (sr !== osr || sc !== osc || ar !== oar || ac !== oac) {
      calculateSlices()
      refreshFillHandle()
    }
  },
)

// smartTable - reactive ref to get the smart table element
const smartTable = ref(null)

// On scroll event listener
// Update the scrollLeft and scrollTop values
useScroll(scrollWrapper, {
  onScroll: (e) => {
    scrollLeft.value = e.target?.scrollLeft
    scrollTop.value = e.target?.scrollTop
    calculateSlices() // Calculate the column slices when the user scrolls
    debouncedUpdateVisibleItems(scrollTop.value) // Update the visible items when the user scrolls

    refreshFillHandle() // Refresh the fill handle when the user scrolls
  },
  behavior: 'auto',
})

// FIELD_ADD -> Triggered when a new column is added
// CLEAR_NEW_ROW -> Triggered when a new row is cleared
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

// eventListenner for mouse down event
// If the user is scrolling, set the scrolling value to true
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

const disableUrlOverlay = ref(false)

provide(CellUrlDisableOverlayInj, disableUrlOverlay)

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

const reloadViewDataHookHandler = async () => {
  await saveOrUpdateRecords({
    keepNewRecords: true,
  })

  await syncCount()
  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
  visibleRows.value = []
  await updateVisibleItems(0, true)

  temporaryNewRowStore.value.forEach((row, index) => {
    row.rowMeta.rowIndex = totalRows.value + index
    cachedLocalRows.value[totalRows.value + index] = row
  })

  totalRows.value = totalRows.value + temporaryNewRowStore.value.length

  await updateVisibleItems(0, true)
}

onMounted(async () => {
  const resizeObserver = new ResizeObserver(() => {
    refreshFillHandle()
    if (activeCell.row !== null && !cachedLocalRows.value?.[activeCell.row]) {
      clearSelectedRange()
      activeCell.row = null
      activeCell.col = null
    }
  })
  if (smartTable.value) resizeObserver.observe(smartTable.value)
})

onBeforeUnmount(async () => {
  /** save/update records before unmounting the component */
  const viewMetaValue = view.value
  const dataValue = Object.values(cachedLocalRows.value)
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
})

openNewRecordFormHook?.on(openNewRecordHandler)

reloadViewDataHook?.on(reloadViewDataHookHandler)

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
              data: Object.values(cachedLocalRows.value),
            })
          }
        }
        try {
          // Sync the count
          await syncCount()
          // Calculate the slices and load the view aggregate and data
          calculateSlices()
          await Promise.allSettled([loadViewAggregate(), updateVisibleItems(scrollTop.value)])
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

defineExpose({
  scrollToRow,
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

    <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 relative nc-scrollbar-x-lg !overflow-auto">
      <NcDropdown
        v-model:visible="contextMenu"
        :trigger="isSqlView ? [] : ['contextmenu']"
        overlay-class-name="nc-dropdown-grid-context-menu"
      >
        <div>
          <table
            :class="{
              mobile: isMobileMode,
              desktop: !isMobileMode,
            }"
            :style="{
              transform: `translateX(${leftOffset}px)`,
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
              <tr v-else class="nc-grid-header">
                <th
                  :style="{
                    left: `-${leftOffset}px`,
                  }"
                  class="w-[64px] min-w-[64px]"
                  data-testid="grid-id-column"
                >
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
                    ...(leftOffset > 0
                      ? {
                          left: `-${leftOffset - 64}px`,
                        }
                      : {}),
                  }"
                  class="nc-grid-column-header column-header column"
                  :class="{
                    '!border-r-blue-400 !border-r-3': toBeDroppedColId === fields[0].id,
                  }"
                  @xcstartresizing="onXcStartResizing(fields[0].id, $event)"
                  @xcresize="onresize(fields[0].id, $event)"
                  @xcresizing="onXcResizing(fields[0].id, $event)"
                  @click="selectColumn(fields[0].id!)"
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
            :style="{
              transform: `translateX(${leftOffset}px)`,
            }"
            @contextmenu="showContextMenu"
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
                :key="`${rowSlice.start + index}-${rowSlice.start + index}`"
                :row="row"
              >
                <template #default="{ state }">
                  <tr
                    class="nc-grid-row transition transition-opacity opacity-100 !xs:h-14"
                    :style="{
                      transform: `translateY(${rowSlice.start + index}px)`,
                      height: `${rowHeight ?? rowHeightInPx['1']}px`,
                    }"
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
                          :active="activeCell.col === colIndex && activeCell.row === rowSlice.start + index"
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
              <tr
                v-if="isAddingEmptyRowAllowed"
                v-e="['c:row:add:grid-bottom']"
                class="text-left nc-grid-add-new-cell cursor-pointer group relative z-3 xs:hidden"
                :class="{
                  '!border-r-2 !border-r-gray-100': visibleColLength === 1,
                }"
                @mouseup.stop
                @click="addEmptyRow()"
              >
                <div
                  class="h-8 border-b-1 border-gray-100 bg-white group-hover:bg-gray-50 absolute left-0 bottom-0 px-2 sticky z-40 w-full flex items-center text-gray-500"
                  :style="{
                    left: `-${leftOffset}px`,
                  }"
                >
                  <component :is="iconMap.plus" class="text-pint-500 text-base ml-2 mt-0 text-gray-600 group-hover:text-black" />
                </div>
                <td class="!border-gray-100" :colspan="visibleColLength"></td>
              </tr>
              <div
                class="placeholder relative bottom-placeholder"
                :style="`height: ${endRowHeight}; top: ${rowSlice.end * rowHeight}px;`"
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
