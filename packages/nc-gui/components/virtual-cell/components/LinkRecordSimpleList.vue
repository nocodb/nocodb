<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

interface SimpleListItem {
  /**
   * `linked` = row of the server-linked group (pinned top at OPEN time) ·
   * `stream` = row of the unlinked stream. Check/uncheck never moves a row —
   * the check state is an in-place overlay and the linked-on-top grouping is
   * recomputed only on the next open.
   */
  kind: 'linked' | 'stream' | 'placeholder'
  /** combined-list index (drives virtualization) */
  index: number
  row?: Record<string, any>
  checked: boolean
}

const props = defineProps<{
  modelValue: boolean
  /** display-value column of the related table (drives row rendering) */
  column?: ColumnType
  /** single-target relations: the currently linked record (host cells pass their chip value) */
  linkedRecord?: Record<string, any> | null
  /**
   * Browse mode — the cell can't be edited. Only the LINKED records are listed
   * (the unlinked stream is never fetched), rows carry no check state and a
   * click only opens the record when the column has click-into-details.
   */
  readonly?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'escape'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const { $e } = useNuxtApp()

const {
  childrenCachedRows,
  childrenCachedTotalRows,
  fetchChildrenChunk,
  clearChildrenCache,
  resetChildrenCache,
  loadChildrenList,
  childrenListPagination,
  excludedCachedRows,
  excludedTotalRows,
  fetchExcludedChunk,
  clearExcludedCache,
  resetExcludedCache,
  loadChildrenExcludedList,
  childrenExcludedListPagination,
  resetChildrenExcludedOffsetCount,
  resetChildrenListOffsetCount,
  isChildrenLoading,
  isChildrenExcludedLoading,
  isSingleTargetRelation,
  relatedTableMeta,
  relatedTableDisplayValueProp,
  getRelatedTableRowId,
  link,
  unlink,
  row,
  refreshCurrentRow,
  CHUNK_SIZE,
} = useLTARStoreOrThrow()

const { addLTARRef, isNew, removeLTARRef, state: rowState } = useSmartsheetRowStoreOrThrow()

const ltarColumn = inject(ColumnInj)

const saveRow = inject(SaveRowInj, () => {})

// Per-column "Click into record details" — provided by the interface viz
// hosts (EE) when the LTAR column has it configured; null everywhere else.
const linkRecordExpand = inject(LinkRecordExpandInj, ref(null))

const filterQueryRef = ref<HTMLInputElement>()

const scrollContainerRef = ref<HTMLElement>()

const searchQuery = ref('')

const SIMPLE_ROW_HEIGHT = 32

const ROW_VIRTUAL_MARGIN = 5

const rowSlice = reactive({ start: 0, end: 0 })

// Session-local link bookkeeping — everything below is per-open-session state.
// The store's per-index linked-state maps are written with the SAME index for
// both lists on link()/unlink() (harmless when only one list is visible, wrong
// for this combined list), so every store call here passes index -1 (the
// classic relinkRow precedent) and the check-state lives entirely in these
// structures until the next open/search reload, when server order takes over.
//
// Rows NEVER move on link/unlink — both caches keep their open-time order and
// the sets below overlay the check state in place. The linked-on-top grouping
// is recomputed only when the dropdown (re)opens.

/** pks of stream rows linked this session — checked in place */
const sessionLinkedPks = ref<Set<string>>(new Set())

/** pks of server-linked rows unlinked this session — unchecked in place, stay on top */
const sessionUnlinkedPks = ref<Set<string>>(new Set())

/**
 * Single-target only: the record removed via "Clear selection" — its pinned
 * row vanishes (it renders from the cell value) and it is NOT in the excluded
 * cache, so it re-surfaces here at the head of the stream to stay pickable.
 */
const sessionClearedRows = ref<Record<string, any>[]>([])

const isSingleTarget = computed(() => isSingleTargetRelation.value)

const canExpandRecords = computed(() => {
  const column = ltarColumn?.value
  return !!column && !!linkRecordExpand.value?.isEnabled(column)
})

/** Browse mode without click-into-details — rows are pure display, no hover/pointer affordance. */
const isRowInert = computed(() => !!props.readonly && !canExpandRecords.value)

/** NEW-row staged links, normalized to an array (single-target stages a bare object) */
function stagedRows(): Record<string, any>[] {
  const colTitle = ltarColumn?.value?.title
  const raw = colTitle ? rowState.value?.[colTitle] : undefined

  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

function rowPk(rec: Record<string, any>) {
  return String(getRelatedTableRowId(rec))
}

const stagedLinkIds = computed(() => {
  if (!isNew.value) return new Set<string>()

  return new Set(stagedRows().map((r) => rowPk(r)))
})

function matchesQuery(rec: Record<string, any>) {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return true

  const value = rec?.[relatedTableDisplayValueProp.value]

  return value !== null && value !== undefined && String(value).toLowerCase().includes(query)
}

const linkedRecord = computed<Record<string, any> | null>(() => {
  if (!isSingleTarget.value) return null
  if (props.linkedRecord !== undefined) return props.linkedRecord
  if (isNew.value) return stagedRows()[0] ?? null

  return ltarColumn?.value?.title ? row.value?.row?.[ltarColumn.value.title] ?? null : null
})

const serverLinkedTotal = computed(() => {
  if (isSingleTarget.value) return linkedRecord.value && matchesQuery(linkedRecord.value) ? 1 : 0
  // New rows: staged links are marked inline in the stream (they also appear
  // there — the new-row picker API can't exclude them), so no pinned section.
  if (isNew.value) return 0

  return childrenCachedTotalRows.value
})

// Nothing moves mid-session, so the totals are simply the two caches plus the
// single-target cleared remnant — the virtual scroll height stays stable.
// Browse mode never fetches the stream, so the linked group is the whole list.
const combinedTotal = computed(() => {
  if (props.readonly) return serverLinkedTotal.value

  return serverLinkedTotal.value + sessionClearedRows.value.length + excludedTotalRows.value
})

const visibleRows = computed<SimpleListItem[]>(() => {
  const items: SimpleListItem[] = []
  const streamStart = serverLinkedTotal.value + sessionClearedRows.value.length

  for (let c = rowSlice.start; c < rowSlice.end; c++) {
    if (c < serverLinkedTotal.value) {
      if (isSingleTarget.value) {
        items.push({ kind: 'linked', index: c, row: linkedRecord.value!, checked: true })
        continue
      }

      const rec = childrenCachedRows.value.get(c)
      if (!rec) {
        items.push({ kind: 'placeholder', index: c, checked: false })
      } else {
        items.push({ kind: 'linked', index: c, row: rec, checked: !sessionUnlinkedPks.value.has(rowPk(rec)) })
      }
    } else if (c < streamStart) {
      items.push({ kind: 'stream', index: c, row: sessionClearedRows.value[c - serverLinkedTotal.value], checked: false })
    } else {
      const rec = excludedCachedRows.value.get(c - streamStart)
      if (!rec) {
        items.push({ kind: 'placeholder', index: c, checked: false })
      } else {
        items.push({
          kind: 'stream',
          index: c,
          row: rec,
          checked: isNew.value ? stagedLinkIds.value.has(rowPk(rec)) : sessionLinkedPks.value.has(rowPk(rec)),
        })
      }
    }
  }

  return items
})

function displayValueOf(rec?: Record<string, any>) {
  return rec?.[relatedTableDisplayValueProp.value]
}

function resetSessionState() {
  sessionLinkedPks.value = new Set()
  sessionUnlinkedPks.value = new Set()
  sessionClearedRows.value = []
}

function calculateSlices() {
  const container = scrollContainerRef.value
  if (!container || combinedTotal.value === 0) return

  const startIndex = Math.max(0, Math.floor(container.scrollTop / SIMPLE_ROW_HEIGHT))
  const visibleCount = Math.ceil(container.clientHeight / SIMPLE_ROW_HEIGHT)
  const endIndex = Math.min(startIndex + visibleCount, combinedTotal.value)

  rowSlice.start = Math.max(0, startIndex - ROW_VIRTUAL_MARGIN)
  rowSlice.end = Math.min(combinedTotal.value, endIndex + ROW_VIRTUAL_MARGIN)
}

function updateVisibleChunks() {
  if (combinedTotal.value === 0) return

  const { start, end } = rowSlice

  // Pinned server-linked section (multi-target) — children cache, direct indexes
  if (!isSingleTarget.value && !isNew.value && serverLinkedTotal.value > 0 && start < serverLinkedTotal.value) {
    const linkedFirst = start
    const linkedLast = Math.min(end - 1, serverLinkedTotal.value - 1)
    const firstChunk = Math.floor(linkedFirst / CHUNK_SIZE)
    const lastChunk = Math.floor(linkedLast / CHUNK_SIZE)
    for (let c = firstChunk; c <= lastChunk; c++) {
      fetchChildrenChunk(c)
    }
    clearChildrenCache(Math.max(0, linkedFirst - 20), Math.min(serverLinkedTotal.value, linkedLast + 20))
  }

  // Unlinked stream — excluded cache, direct indexes past the pinned section
  const streamStart = serverLinkedTotal.value + sessionClearedRows.value.length
  if (end > streamStart) {
    const streamFirst = Math.max(0, start - streamStart)
    const streamLast = Math.max(0, end - 1 - streamStart)
    const firstChunk = Math.floor(streamFirst / CHUNK_SIZE)
    const lastChunk = Math.floor(streamLast / CHUNK_SIZE)
    for (let c = firstChunk; c <= lastChunk; c++) {
      fetchExcludedChunk(c)
    }
    clearExcludedCache(Math.max(0, streamFirst - 20), streamLast + 20)
  }
}

const debouncedUpdateVisibleChunks = useDebounceFn(updateVisibleChunks, 50, { maxWait: 100 })

function onListScroll() {
  calculateSlices()
  debouncedUpdateVisibleChunks()
}

async function checkRow(item: SimpleListItem) {
  if (!item.row) return

  if (isNew.value) {
    await addLTARRef(item.row, ltarColumn?.value as ColumnType)
    saveRow()
    $e('a:links:link')
    return
  }

  await link(item.row, {}, -1)

  // Check in place — no repositioning until the next open.
  const pk = rowPk(item.row)
  if (item.kind === 'linked') {
    const next = new Set(sessionUnlinkedPks.value)
    next.delete(pk)
    sessionUnlinkedPks.value = next
  } else {
    sessionLinkedPks.value = new Set(sessionLinkedPks.value).add(pk)
  }
}

async function uncheckRow(item: SimpleListItem) {
  if (!item.row) return

  if (isNew.value) {
    // resolve back to the staged buffer object by pk (identity match)
    const target = stagedRows().find((r) => rowPk(r) === rowPk(item.row!)) ?? item.row
    await removeLTARRef(target, ltarColumn?.value as ColumnType)
    saveRow()
    $e('a:links:unlink')
    return
  }

  await unlink(item.row, {}, -1)

  // Uncheck in place — server-linked rows STAY in the top group unchecked;
  // the next open re-sorts from the server.
  const pk = rowPk(item.row)
  if (item.kind === 'linked') {
    sessionUnlinkedPks.value = new Set(sessionUnlinkedPks.value).add(pk)
  } else {
    const next = new Set(sessionLinkedPks.value)
    next.delete(pk)
    sessionLinkedPks.value = next
  }
}

async function onSingleTargetPick(item: SimpleListItem) {
  if (!item.row) return

  // clicking the current selection is a no-op — unlink goes through "Clear selection"
  if (item.kind === 'linked' && item.checked) return

  if (isNew.value) {
    await addLTARRef(item.row, ltarColumn?.value as ColumnType)
    saveRow()
    $e('a:links:link')
  } else {
    await link(item.row, {}, -1)
  }

  vModel.value = false
}

function expandItem(item: SimpleListItem) {
  const api = linkRecordExpand.value
  const column = ltarColumn?.value
  if (!api || !column || !item.row || !relatedTableMeta.value) return

  vModel.value = false
  api.expand({ column, row: item.row, relatedTableMeta: relatedTableMeta.value })
}

async function onRowClick(item: SimpleListItem) {
  if (item.kind === 'placeholder' || !item.row) return

  // Browse mode: nothing to check — the row only opens the record when the
  // column has click-into-details, otherwise it's inert.
  if (props.readonly) {
    if (canExpandRecords.value) expandItem(item)
    return
  }

  if (isSingleTarget.value) {
    await onSingleTargetPick(item)
    return
  }

  if (item.checked) {
    await uncheckRow(item)
  } else {
    await checkRow(item)
  }
}

async function clearSelection() {
  if (!linkedRecord.value) return

  if (isNew.value) {
    const target = stagedRows()[0] ?? linkedRecord.value
    await removeLTARRef(target, ltarColumn?.value as ColumnType)
    saveRow()
    $e('a:links:unlink')
    return
  }

  const cleared = linkedRecord.value

  await unlink(cleared, {}, -1)

  // The stream was fetched while this record was excluded server-side — its
  // pinned row vanishes with the cell value, so re-surface it at the head of
  // the stream to stay pickable, no reload.
  sessionClearedRows.value = [...sessionClearedRows.value, cleared]
}

function onFilterChange() {
  // Store watchers on the two queries reset their caches and debounce-reload;
  // session pinning resets too — after the reload the server already reflects
  // this session's links (linked → children list, gone from excluded).
  // Browse mode leaves the excluded query alone — writing it would trigger a
  // reload of a stream this list never shows.
  if (!props.readonly) childrenExcludedListPagination.query = searchQuery.value
  childrenListPagination.query = searchQuery.value
  resetSessionState()

  if (scrollContainerRef.value) scrollContainerRef.value.scrollTop = 0
  rowSlice.start = 0
  rowSlice.end = 0
  // The combinedTotal watcher re-slices when the reload lands; recalculate here
  // too in case the new result set reports the same totals (watcher won't fire).
  calculateSlices()
  debouncedUpdateVisibleChunks()
}

const { handleSearchKeydown } = useLTARListKeyNav({
  scrollContainerRef,
  filterQueryRef,
  itemTestId: 'nc-simple-link-list-item',
  expandedFormDlg: ref(false),
  closeModal: () => {
    vModel.value = false
  },
  getQuery: () => searchQuery.value,
  onEscapeEmptyQuery: () => emit('escape'),
  onEnterWithQuery: () => {
    // Stream rows can be checked in place now — Enter links the first unlinked one.
    const first = visibleRows.value.find((item) => item.kind === 'stream' && item.row && !item.checked)
    if (first) onRowClick(first)
  },
})

watch(
  vModel,
  (next, prev) => {
    if (next && !prev) {
      refreshCurrentRow()
      resetSessionState()
      searchQuery.value = ''
      childrenExcludedListPagination.query = ''
      childrenListPagination.query = ''
      childrenExcludedListPagination.page = 1
      if (!isSingleTarget.value && !isNew.value) {
        loadChildrenList(true)
      }
      // Browse mode lists linked records only — never fetch the related
      // table's unlinked stream for a cell that can't link anything.
      if (!props.readonly) {
        loadChildrenExcludedList(rowState.value, true)
      }
    }

    if (!next) {
      resetChildrenExcludedOffsetCount()
      resetChildrenListOffsetCount()
    }
  },
  { immediate: true },
)

watch(combinedTotal, () => {
  calculateSlices()
  debouncedUpdateVisibleChunks()
})

// Covers mount, the auto-fit wrapper growing as records load, and manual
// drag-resize of the dropdown — all change how many rows fit the viewport.
useResizeObserver(scrollContainerRef, () => {
  calculateSlices()
  debouncedUpdateVisibleChunks()
})

whenever(vModel, () => {
  if (isMobileMode.value) return
  setTimeout(() => {
    filterQueryRef.value?.focus()
  }, 100)
})

onMounted(() => {
  if (isMobileMode.value) return
  setTimeout(() => {
    filterQueryRef.value?.focus()
  }, 100)
})

onUnmounted(() => {
  resetChildrenExcludedOffsetCount()
  resetChildrenListOffsetCount()
  resetExcludedCache()
  resetChildrenCache()
  childrenExcludedListPagination.query = ''
  childrenListPagination.query = ''
})
</script>

<template>
  <div
    class="nc-simple-link-list flex-1 min-h-0 w-full flex flex-col overflow-hidden"
    :class="{ active: vModel }"
    @keydown.enter.stop
  >
    <div class="nc-simple-link-list-header flex items-center px-3 py-2 border-b-1 border-nc-border-gray-light">
      <a-input
        ref="filterQueryRef"
        v-model:value="searchQuery"
        :bordered="false"
        :placeholder="`${$t('placeholder.searchRecords')}...`"
        class="nc-simple-link-search-input w-full min-h-4 !pl-0"
        size="small"
        autocomplete="off"
        data-testid="nc-simple-link-search"
        @change="onFilterChange"
        @keydown.capture.stop="handleSearchKeydown"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="nc-search-icon mr-2 h-4 w-4 text-nc-content-gray-muted" />
        </template>
      </a-input>
    </div>

    <div
      v-if="isSingleTarget && linkedRecord && !readonly"
      v-e="['c:cell:links:simple-list:clear']"
      class="nc-simple-link-clear-row flex items-center mx-1.5 mt-1 px-2 h-7 rounded-md flex-none cursor-pointer text-[13px] leading-5 text-nc-content-gray-muted hover:(bg-nc-bg-gray-light text-nc-content-gray-subtle)"
      data-testid="nc-simple-link-clear-selection"
      tabindex="0"
      @click="clearSelection"
      @keydown.enter.prevent.stop="clearSelection"
    >
      {{ $t('labels.clearSelection') }}
    </div>

    <!-- min-h-48 = 6 rows × 32px: the dropdown always reserves at least six record
         rows below the search header / clear-selection row, then grows to the cap -->
    <div ref="scrollContainerRef" class="flex-1 min-h-48 overflow-auto nc-scrollbar-thin" @scroll="onListScroll">
      <template v-if="combinedTotal > 0">
        <div :style="{ height: `${rowSlice.start * SIMPLE_ROW_HEIGHT}px` }" />

        <template v-for="item in visibleRows" :key="item.index">
          <div
            v-if="item.kind === 'placeholder'"
            :style="{ height: `${SIMPLE_ROW_HEIGHT}px` }"
            class="flex items-center mx-1.5 px-2"
          >
            <a-skeleton-input active class="!h-4 !w-40 !rounded-md overflow-hidden" size="small" />
          </div>
          <div
            v-else
            :style="{ height: `${SIMPLE_ROW_HEIGHT}px` }"
            class="nc-simple-link-list-item flex items-center gap-2 py-0.5"
            :class="{ 'nc-simple-link-list-item-linked': item.checked, 'nc-simple-link-list-item-inert': isRowInert }"
            data-testid="nc-simple-link-list-item"
            tabindex="0"
            @click="onRowClick(item)"
            @keydown.space.prevent.stop="onRowClick(item)"
            @keydown.enter.prevent.stop="onRowClick(item)"
          >
            <div
              class="nc-simple-link-list-item-inner flex items-center gap-2 flex-1 min-w-0 h-full mx-1.5 px-2 rounded-md"
              :class="isRowInert ? 'cursor-default' : 'cursor-pointer'"
            >
              <NcCheckbox v-if="!isSingleTarget && !readonly" :checked="item.checked" class="pointer-events-none flex-none" />
              <div class="flex-1 truncate text-[13px] leading-5 text-nc-content-gray">
                <SmartsheetPlainCell
                  v-if="props.column"
                  :model-value="displayValueOf(item.row)"
                  :column="props.column"
                  class="truncate"
                />
                <template v-else>{{ displayValueOf(item.row) }}</template>
              </div>
              <NcTooltip
                v-if="canExpandRecords"
                :title="$t('labels.expandRecord')"
                placement="top"
                :arrow="false"
                class="flex-none"
              >
                <NcButton
                  v-e="['c:cell:links:simple-list:expand']"
                  type="text"
                  size="xxsmall"
                  class="nc-simple-link-list-item-expand opacity-0 text-nc-content-gray-subtle"
                  data-testid="nc-simple-link-expand"
                  @click.stop="expandItem(item)"
                >
                  <template #icon>
                    <GeneralIcon icon="maximize" class="h-3.5 w-3.5" />
                  </template>
                </NcButton>
              </NcTooltip>
              <GeneralIcon
                v-if="isSingleTarget && item.checked && !readonly"
                icon="check"
                class="flex-none h-4 w-4 text-nc-content-brand"
              />
            </div>
          </div>
        </template>

        <div :style="{ height: `${Math.max(0, combinedTotal - rowSlice.end) * SIMPLE_ROW_HEIGHT}px` }" />
      </template>

      <div
        v-else-if="readonly ? isChildrenLoading : isChildrenExcludedLoading"
        class="flex flex-col"
        data-testid="nc-simple-link-list-loading"
      >
        <div v-for="i in 5" :key="i" :style="{ height: `${SIMPLE_ROW_HEIGHT}px` }" class="flex items-center mx-1.5 px-2">
          <a-skeleton-input active class="!h-4 !w-40 !rounded-md overflow-hidden" size="small" />
        </div>
      </div>

      <div v-else class="min-h-48 flex items-center justify-center text-nc-content-gray-muted text-bodySm px-3 text-center">
        <template v-if="searchQuery">{{ $t('msg.noRecordsMatchYourSearchQuery') }}</template>
        <template v-else-if="readonly">{{ $t('msg.noRecordsLinked') }}</template>
        <template v-else>{{ $t('msg.noRecordsAvailForLinking') }}</template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-simple-link-list-header {
  :deep(input) {
    @apply text-[13px] font-medium;

    &::placeholder {
      @apply text-nc-content-gray-muted font-normal;
    }
  }
}

.nc-simple-link-list-item {
  .nc-simple-link-list-item-inner:hover {
    @apply bg-nc-bg-gray-light;
  }

  /* Browse mode with nothing to click — no hover highlight promising an action */
  &.nc-simple-link-list-item-inert .nc-simple-link-list-item-inner:hover {
    @apply bg-transparent;
  }

  &:hover .nc-simple-link-list-item-expand,
  &:focus-visible .nc-simple-link-list-item-expand {
    @apply opacity-100;
  }

  &:focus-visible {
    @apply outline-none;

    .nc-simple-link-list-item-inner {
      @apply bg-nc-bg-gray-light;
    }
  }
}
</style>
