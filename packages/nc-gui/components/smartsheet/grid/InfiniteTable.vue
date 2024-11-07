<script setup lang="ts">
import {
  type ColumnReqType,
  type ColumnType,
  type PaginatedType,
  type TableType,
  UITypes,
  type ViewType,
  isVirtualCol,
} from 'nocodb-sdk'
import type { Group, Row } from '../../../lib/types'
import type { CellRange } from '../../../composables/useMultiSelect/cellRange'
import { useColumnDrag } from './useColumnDrag'

const props = defineProps<{
  data: Row[]
  vGroup?: Group
  paginationData?: PaginatedType
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
  changePage?: (page: number) => void
  callAddEmptyRow?: (addAfter?: number) => Row | undefined
  deleteRow?: (rowIndex: number, undo?: boolean) => Promise<void>
  updateOrSaveRow?: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
  ) => Promise<any>
  selectedAllRecords?: boolean
  deleteRangeOfRows?: (cellRange: CellRange) => Promise<void>
  rowHeight?: number
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean, groupKey?: string) => void
  deleteSelectedRows?: () => Promise<void>
  removeRowIfNew?: (row: Row) => void
  bulkUpdateRows?: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  headerOnly?: boolean
  hideHeader?: boolean
  hideCheckbox?: boolean
  pagination?: {
    fixedSize?: number
    hideSidebars?: boolean
    extraStyle?: string
  }
  disableSkeleton?: boolean
  disableVirtualX?: boolean
  disableVirtualY?: boolean
}>()

const emits = defineEmits(['update:selectedAllRecords', 'bulkUpdateDlg', 'toggleOptimisedQuery'])

const { loadData, callAddEmptyRow, updateOrSaveRow, deleteRow, expandForm } = props

// Temp Below

const switchingTab = ref(false)

/// Temp TOp

const VIRTUAL_MARGIN = 5

const bufferSize = 100

const maxCacheSize = 1000

const { isMobileMode } = useGlobal()

// Table Meta
const meta = inject(MetaInj, ref())

const fields = inject(FieldsInj, ref([]))

// Is the view is Locked
const isLocked = inject(IsLockedInj, ref(false))

const isPublicView = inject(IsPublicInj, ref(false))

// Readonly Mode. If true, user can't edit the data
const readOnly = inject(ReadonlyInj, ref(false))

const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

const paginationDataRef = toRef(props, 'paginationData')

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

const totalRows = computed(() => {
  return paginationDataRef.value?.totalRows ?? 100000
})

const cachedLocalRows = ref<Record<number, Row>>({})

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

const clearCache = (visibleStartIndex: number, visibleEndIndex: number) => {
  // If the cache size is less than the maxCacheSize, skip
  const cacheSize = Object.keys(cachedLocalRows.value).length
  if (cacheSize <= maxCacheSize) return

  // Calculate the number of items to remove
  const itemsToRemove = cacheSize - maxCacheSize
  const sortedIndices = Object.keys(cachedLocalRows.value)
    .map(Number)
    .sort((a, b) => a - b)

  // Calculate the safe start
  const safeStartIndex = Math.max(0, visibleStartIndex - bufferSize)

  // Ensure the end index is within the total items and within the buffer size
  const safeEndIndex = Math.min(totalRows.value - 1, visibleEndIndex + bufferSize)

  let removed = 0

  // Remove items from the start of the cache
  for (let i = 0; i < sortedIndices.length && removed < itemsToRemove; i++) {
    if (sortedIndices[i] < safeStartIndex) {
      delete cachedLocalRows.value[sortedIndices[i]]
      removed++
    }
  }

  // If we still need to remove items, remove from the end
  for (let i = sortedIndices.length - 1; i >= 0 && removed < itemsToRemove; i--) {
    if (sortedIndices[i] > safeEndIndex) {
      delete cachedLocalRows.value[sortedIndices[i]]
      removed++
    }
  }
}

// Flag to prevent multiple updates
const isUpdating = ref(false)

const updateVisibleItems = async (newScrollTop: number) => {
  // If we are already updating the visibleItems, skip
  if (isUpdating.value) return
  isUpdating.value = true

  // Calculate the start and end index of the visible items
  // Add a buffer to top and bottom to make the elements load before they are visible
  const startIndex = Math.max(0, Math.floor(newScrollTop / rowHeightInPx[`${props.rowHeight}`]) - Math.floor(bufferSize / 2))
  const visibleCount = Math.ceil(scrollWrapper.value.clientHeight / rowHeightInPx[`${props.rowHeight}`])
  const endIndex = Math.min(startIndex + visibleCount + bufferSize, totalRows.value)

  rowSlice.start = startIndex
  rowSlice.end = endIndex

  // Determine which items we need to fetch
  // If the item is not in the cache, we need to fetch it
  const itemsToFetch = []
  for (let i = startIndex; i < endIndex; i++) {
    if (!cachedLocalRows.value[i]) {
      itemsToFetch.push(i)
    }
  }

  // Update visible items from cache first
  visibleRows.value = Array.from({ length: endIndex - startIndex }, (_, i) => {
    const index = startIndex + i
    return cachedLocalRows.value[index] || { row: {}, oldRow: {}, rowMeta: { rowIndex: index, loading: true, selected: false } }
  })

  // Fetch missing items
  // We set the offset to the first unavailable item and the limit to the last unavailable item
  if (itemsToFetch.length > 0) {
    try {
      const newItems = await loadData({
        offset: itemsToFetch[0],
        limit: itemsToFetch[itemsToFetch.length - 1] + 1 - itemsToFetch[0],
      })
      newItems.forEach((item) => {
        cachedLocalRows.value[item.rowMeta.rowIndex!] = item
      })

      // Update visible items again after fetching
      visibleRows.value = Array.from({ length: endIndex - startIndex }, (_, i) => {
        const index = startIndex + i
        return cachedLocalRows.value[index] || { row: {}, oldRow: {}, rowMeta: { rowIndex: index, selected: false } }
      })
      clearCache(startIndex, endIndex)
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  await nextTick()
  isUpdating.value = false
}

const debouncedUpdateVisibleItems = useDebounceFn(updateVisibleItems, 100)

watch(scrollTop, debouncedUpdateVisibleItems)

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

let animationFrames: number | null = null

useScroll(scrollWrapper, {
  onScroll: (e) => {
    scrollLeft.value = e.target?.scrollLeft
    scrollTop.value = e.target?.scrollTop
    if (animationFrames) {
      cancelAnimationFrame(animationFrames)
    }
    animationFrames = requestAnimationFrame(() => {
      calculateSlices()
      // refreshFillHandle()
    })
  },
})

// Check
const { isUIAllowed, isDataReadOnly } = useRoles()
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))
const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('fieldAdd') && !isSqlView.value)

onMounted(() => {
  until(scrollWrapper)
    .toBeTruthy()
    .then(async () => {
      calculateSlices()

      await Promise.allSettled([loadViewAggregate(), updateVisibleItems(0)])
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
    // TODO: Implement this
    /* clearSelectedRange()
    activeCell.row = null
    activeCell.col = null

    removeRowIfNew?.(payload) */
  }
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
    <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 relative nc-scrollbar-x-lg !overflow-auto">
      <table
        :class="{
          mobile: isMobileMode,
          desktop: !isMobileMode,
        }"
        class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white sticky top-0 z-5 bg-white"
      >
        <thead v-show="hideHeader !== true" ref="tableHeadEl">
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
                <template v-if="!readOnly && !hideCheckbox">
                  <div class="nc-no-label text-gray-500">#</div>
                  <div
                    :class="{
                      hidden: !vSelectedAllRecords,
                      flex: vSelectedAllRecords,
                    }"
                    class="nc-check-all w-full items-center"
                  >
                    <a-checkbox v-model:checked="vSelectedAllRecords" />

                    <span class="flex-1" />
                  </div>
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
        v-if="headerOnly !== true"
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
            <div v-for="(_, index) in 6" :key="index" class="placeholder-column" :style="{ left: `${index * 150}px` }"></div>
          </div>
          <LazySmartsheetRow
            v-for="(row, index) in visibleRows"
            :key="`${rowSlice.start + index}-${row.rowMeta.rowIndex}`"
            :row="row"
          >
            <template #default="{ state }">
              <tr
                class="nc-grid-row !xs:h-14"
                :style="{ transform: `translateY(${rowSlice.start * rowHeightInPx[`${rowHeight}`]}px)` }"
                :data-testid="`grid-row-${index}`"
                :class="{
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
                    'nc-required-cell': cellMeta[index][0].isColumnRequiredAndNull && !isPublicView,
                    'align-middle': !rowHeight || rowHeight === 1,
                    'align-top': rowHeight && rowHeight !== 1,
                    'readonly': colMeta[0].isReadonly && hasEditPermission,
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
                >
                  <div v-if="!switchingTab" class="w-full">
                    <LazySmartsheetVirtualCell
                      v-if="fields[0] && colMeta[0].isVirtualCol && fields[0].title"
                      v-model="row.row[fields[0].title]"
                      :column="fields[0]"
                      :row="row"
                      :read-only="!hasEditPermission"
                      @save="updateOrSaveRow?.(row, '', state)"
                    />

                    <LazySmartsheetCell
                      v-else-if="fields[0] && fields[0].title"
                      v-model="row.row[fields[0].title]"
                      :column="fields[0]"
                      :edit-enabled="!!hasEditPermission"
                      :row-index="rowSlice.start + index"
                      :read-only="!hasEditPermission"
                      @save="updateOrSaveRow?.(row, fields[0].title, state)"
                    />
                  </div>
                </SmartsheetTableDataCell>
                <SmartsheetTableDataCell
                  v-for="{ field: columnObj, index: colIndex } of visibleFields"
                  :key="`cell-${colIndex}-${rowSlice.start + index}`"
                  class="cell relative nc-grid-cell cursor-pointer"
                  :class="{
                    'nc-required-cell': cellMeta[index][colIndex].isColumnRequiredAndNull && !isPublicView,
                    'align-middle': !rowHeight || rowHeight === 1,
                    'align-top': rowHeight && rowHeight !== 1,
                    'readonly': colMeta[colIndex].isReadonly && hasEditPermission,
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
                >
                  <div v-if="!switchingTab" class="w-full">
                    <LazySmartsheetVirtualCell
                      v-if="colMeta[colIndex].isVirtualCol && columnObj.title"
                      v-model="row.row[columnObj.title]"
                      :column="columnObj"
                      :row="row"
                      :read-only="!hasEditPermission"
                      @save="updateOrSaveRow?.(row, '', state)"
                    />

                    <LazySmartsheetCell
                      v-else-if="columnObj.title"
                      v-model="row.row[columnObj.title]"
                      :edit-enabled="false"
                      :column="columnObj"
                      :row-index="rowSlice.start + index"
                      :read-only="!hasEditPermission"
                      @save="updateOrSaveRow?.(row, columnObj.title, state)"
                    />
                  </div>
                </SmartsheetTableDataCell>
              </tr>
            </template>
          </LazySmartsheetRow>
          <div
            class="placeholder bottom-placeholder"
            :style="`height: ${endRowHeight}; top: ${rowSlice.end * rowHeightInPx[`${props.rowHeight}`]}px;`"
          >
            <div v-for="(_, index) in 6" :key="index" class="placeholder-column" :style="{ left: `${index * 170}px` }"></div>
          </div>
        </tbody>
      </table>
    </div>

    <LazySmartsheetGridPaginationV2 :scroll-left="scrollLeft" :disable-pagination="true" />
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
  background-color: #ccc;
  background-image: linear-gradient(0deg, #d7d8d9 1.52%, #fff 0, #fff 50%, #d7d8d9 0, #d7d8d9 51.52%, #fff 0, #fff);
  background-size: 66px 66px;
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
}

.top-placeholder {
  top: 0;
}

.bottom-placeholder {
  bottom: 0;
}
</style>
