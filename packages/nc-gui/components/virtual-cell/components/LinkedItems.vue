<script lang="ts" setup>
import Draggable from 'vuedraggable'
import { type ColumnType, isDateOrDateTimeCol } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey } from 'nocodb-sdk'
import { computeLtarNewRowState } from '~/utils/dataUtils'

interface Prop {
  modelValue?: boolean
  cellValue: any
  column: any
  items: number
  /** Breadcrumb trail passed from parent (across dropdown teleport boundary) */
  parentBreadcrumbs?: string[]
  /** Grid interface: allow expanding a linked record (follows viz inline-edit toggle) */
  allowRecordExpand?: boolean
  /** Grid interface: allow the "+ New record" button (follows viz add-record toggle) */
  allowNewRecord?: boolean
}

const props = withDefaults(defineProps<Prop>(), {
  allowRecordExpand: true,
  allowNewRecord: true,
})

const emit = defineEmits(['update:modelValue', 'attachRecord', 'escape'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isTemplateMode = inject(IsTemplateModeInj, ref(false))

// Use prop-based breadcrumbs (injection doesn't work across dropdown teleport boundary)
const parentBreadcrumbs = computed(() => props.parentBreadcrumbs || [])

const isExpandedFormCloseAfterSave = ref(false)

const isNewRecord = ref(false)

const isBlueprintMode = ref(false)

const injectedColumn = inject(ColumnInj, ref())

const readOnly = inject(ReadonlyInj, ref(false))

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const filterQueryRef = ref<HTMLInputElement>()

const scrollContainerRef = ref<HTMLElement>()

const { isDataReadOnly } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const {
  childrenList,
  childrenListCount,
  loadChildrenList,
  childrenListPagination,
  childrenExcludedOffsetCount,
  childrenListOffsetCount,
  relatedTableDisplayValueProp,
  displayValueTypeAndFormatProp,
  unlink,
  isChildrenListLinked,
  isChildrenLoading,
  relatedTableMeta,
  link,
  meta,
  isLinkedTableAccessible,
  row,
  loadRelatedTableMeta,
  resetChildrenListOffsetCount,
  attachmentCol,
  fields,
  refreshCurrentRow,
  rowId,
  relatedTableDisplayValueColumn,
  externalBaseUserRoles,
  // Chunked cache
  CHUNK_SIZE: _CHUNK_SIZE,
  ROW_HEIGHT,
  childrenCachedRows,
  childrenCachedTotalRows,
  childrenCachedLinkedState,
  childrenCachedLoadingState,
  fetchChildrenChunk,
  clearChildrenCache,
  resetChildrenCache,
  shouldDefer,
  isSingleTargetRelation,
  pendingLinkRows,
  removePendingLink,
  isPendingUnlink,
  canReorder,
  reorderLink,
  getRelatedTableRowId,
} = useLTARStoreOrThrow()

const { withLoading } = useLoadingTrigger()

const { isNew, state, removeLTARRef, addLTARRef } = useSmartsheetRowStoreOrThrow()

// Buffered (unsaved) links to show ABOVE the persisted virtual list. Only for an
// existing row edited in the expanded form (deferred mode) and multi-target
// relations — grid inline (shouldDefer=false) and new rows (rendered via the
// normal list) are unaffected; single-target uses the row mirror + count.
const showPendingLinks = computed(
  () => shouldDefer.value && !isNew.value && !isSingleTargetRelation.value && pendingLinkRows.value.length > 0,
)

const { showRecordPlanLimitExceededModal } = useEeConfig()

// ── Per-link drag-to-reorder (v2 mm on Postgres) ──────────────────────────────
// Only for editable, non-form, non-public, persisted rows, when the whole set is
// small enough to load and render as a plain (non-virtualized) draggable list.
// Larger sets keep the windowed, non-draggable rendering.
const REORDER_MAX = 50

const reorderEnabled = computed(
  () =>
    canReorder.value &&
    !readOnly.value &&
    !isPublic.value &&
    !isForm.value &&
    !isNew.value &&
    !childrenListPagination.query &&
    childrenListCount.value > 1 &&
    childrenListCount.value <= REORDER_MAX,
)

// Local, mutable copy of the linked rows that vuedraggable reorders in place.
const reorderRows = ref<Record<string, any>[]>([])

const syncReorderRows = () => {
  reorderRows.value = [...(childrenList.value?.list ?? [])]
}

// When reorder becomes active, make sure the FULL set (up to REORDER_MAX) is
// loaded into a single page, then mirror it into the draggable list.
watch(
  reorderEnabled,
  async (enabled) => {
    if (!enabled) return
    if ((childrenList.value?.list?.length ?? 0) < childrenListCount.value) {
      await loadChildrenList(true, undefined, REORDER_MAX)
    }
    syncReorderRows()
  },
  { immediate: true },
)

// Keep the draggable list in sync when the underlying list changes (e.g. after a
// reorder reload or an unlink) — but only while not mid-list-load.
watch(childrenList, () => {
  if (reorderEnabled.value) syncReorderRows()
})

const onReorderEnd = async (evt: { oldIndex?: number; newIndex?: number }) => {
  const { oldIndex, newIndex } = evt
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return

  // vuedraggable has already reordered `reorderRows` in place: the moved row is at
  // newIndex, and the row it must sit BEFORE is the next one (or null = to end).
  const movedRow = reorderRows.value[newIndex]
  const beforeRow = reorderRows.value[newIndex + 1] ?? null
  if (!movedRow) return

  try {
    await reorderLink(movedRow, beforeRow)
  } catch (e) {
    // On failure, resync from the (unchanged) source of truth.
    message.error(await extractSdkResponseErrorMsg(e))
    syncReorderRows()
  }
}

watch(
  [vModel, isForm],
  (nextVal) => {
    if ((nextVal[0] || nextVal[1]) && !isNew.value) {
      refreshCurrentRow()
      loadChildrenList(true)
    }

    // reset offset count when closing modal
    if (!nextVal[0]) {
      resetChildrenListOffsetCount()
    }
  },
  { immediate: true },
)

const unlinkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    // The virtual list hands over a decorated COPY ({...row, _index, ...}) —
    // removeLTARRef locates the staged entry by deep comparison, which the
    // copy defeats (reactive unwrapping skews the compare). The list entry at
    // _index IS the staged buffer object, so pass THAT — identity match.
    const original = childrenList.value?.list?.[row._index ?? id] ?? row
    await removeLTARRef(original, injectedColumn?.value as ColumnType)
    // New-row list renders the staged buffer — refresh the snapshot like the
    // add paths do, or the unlinked record keeps showing.
    loadChildrenList(false, state.value)
  } else {
    await unlink(row, {}, id)
  }
}

const linkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    await addLTARRef(row, injectedColumn?.value as ColumnType)
  } else {
    await link(row, {}, id)
  }
}

const expandedFormDlg = ref(false)

const expandedFormRow = ref({})

const newRowState = computed(() =>
  computeLtarNewRowState(
    injectedColumn?.value as ColumnType,
    relatedTableMeta?.value,
    meta.value?.id,
    row?.value?.row,
    isNew.value,
  ),
)

const colTitle = computed(() => injectedColumn.value?.title || '')

const onClick = (row: Row) => {
  if (isPublic.value || isForm.value) return
  // Don't allow expanding if linked table is not accessible
  if (!isLinkedTableAccessible.value) return
  expandedFormRow.value = row
  expandedFormDlg.value = true
}
const addNewRecord = () => {
  if (readOnly.value) return
  if (showRecordPlanLimitExceededModal()) return
  // Don't allow creating new record if linked table is not accessible
  if (!isLinkedTableAccessible.value) return

  expandedFormRow.value = {}
  expandedFormDlg.value = true
  isExpandedFormCloseAfterSave.value = true
  isNewRecord.value = true
  isBlueprintMode.value = false
}

const reloadViewDataListener = withLoading((params) => {
  if (params?.isFromLinkRecord) {
    refreshCurrentRow()
    loadChildrenList()
  }
})

reloadViewDataTrigger.on(reloadViewDataListener)

onBeforeUnmount(() => {
  reloadViewDataTrigger.off(reloadViewDataListener)
})

const onCreatedRecord = async (record: any) => {
  // Blueprint mode: store the record data as a blueprint in ltarState (no real record created)
  if (isBlueprintMode.value) {
    const blueprint = { ...record, _isBlueprint: true }
    await addLTARRef(blueprint, injectedColumn?.value as ColumnType)
    loadChildrenList(false, state.value)
    isBlueprintMode.value = false
    isNewRecord.value = false
    return
  }

  reloadTrigger?.trigger({
    shouldShowLoading: false,
  })

  reloadViewDataTrigger?.trigger({
    shouldShowLoading: false,
    isFromLinkRecord: true,
    relatedTableMetaId: relatedTableMeta.value.id,
    rowId: rowId.value!,
  })

  if (!isNewRecord.value) return

  if (!isNew.value) {
    vModel.value = false
  } else {
    await addLTARRef(record, injectedColumn?.value as ColumnType)

    loadChildrenList(false, state.value)
  }

  const msgVNode = h(
    'div',
    {
      class: 'ml-1 inline-flex flex-col gap-1 items-start',
    },
    [
      h(
        'span',
        {
          class: 'font-semibold',
        },
        t('activity.recordCreatedLinked'),
      ),
      h(
        'span',
        {
          class: 'text-nc-content-gray-muted',
        },
        t('activity.gotSavedLinkedSuccessfully', {
          tableName: relatedTableMeta.value?.title,
          recordTitle: record[relatedTableDisplayValueProp.value],
        }),
      ),
    ],
  )

  message.success(msgVNode)

  isNewRecord.value = false
}

const onDeletedRecord = () => {
  loadChildrenList(true)
}

const relation = computed(() => {
  return injectedColumn!.value?.colOptions?.type
})

watch(
  () => props.cellValue,
  () => {
    if (isNew.value) loadChildrenList(false, state.value)
  },
  {
    immediate: true,
  },
)

watch(expandedFormDlg, () => {
  if (!expandedFormDlg.value) {
    isExpandedFormCloseAfterSave.value = false
  }
  childrenExcludedOffsetCount.value = 0
  childrenListOffsetCount.value = 0
})

/*
   to render same number of skeleton as the number of cards
   displayed
 */
const skeletonCount = computed(() => {
  if (props.items < 10 && childrenListPagination.page === 1) {
    return props.items
  }

  if (childrenListCount.value < 10 && childrenListPagination.page === 1) {
    return childrenListCount.value || 10
  }
  const totalRows = Math.ceil(childrenListCount.value / 10)

  if (totalRows === childrenListPagination.page) {
    return childrenListCount.value % 10
  }
  return 10
})

const totalItemsToShow = computed(() => {
  if (isForm.value || isNew.value) {
    return state.value?.[colTitle.value]?.length
  }

  if (isChildrenLoading.value) {
    return props.items
  }
  return childrenListCount.value
})

const isDataExist = computed<boolean>(() => {
  return childrenList.value?.pageInfo?.totalRows || (isNew.value && state.value?.[colTitle.value]?.length)
})

const linkOrUnLink = (rowRef: Record<string, string>, id: string) => {
  if (isSharedBase.value) return
  if (readOnly.value) return

  if (isPublic.value && !isForm.value) return
  if (isNew.value || isChildrenListLinked.value[parseInt(id)]) {
    unlinkRow(rowRef, parseInt(id))
  } else {
    linkRow(rowRef, parseInt(id))
  }
}

watch([filterQueryRef, isDataExist], () => {
  // Don't focus input on open dropdown in mobile mode
  if (isMobileMode.value) return

  if (readOnly.value || isPublic.value ? isDataExist.value : true) {
    filterQueryRef.value?.focus()
  }
})

onMounted(() => {
  loadRelatedTableMeta()

  // Load initial chunk for virtual scroll
  fetchChildrenChunk(0)

  // Don't focus input on open dropdown in mobile mode
  if (isMobileMode.value) return
  setTimeout(() => {
    filterQueryRef.value?.focus()
  }, 100)
})

const ROW_VIRTUAL_MARGIN = 5

const rowSlice = reactive({ start: 0, end: 0 })

const calculateSlices = () => {
  if (childrenCachedTotalRows.value === 0) return

  const container = scrollContainerRef.value
  const scrollTop = container?.scrollTop ?? 0
  // Fall back to a sensible viewport height when the scroll container isn't measured yet
  // (e.g. first open with buffered pending links, before the DOM flush binds the ref).
  // Without this the persisted list would compute an empty slice and only render after a
  // scroll / reopen, hiding already-linked records on first open. (#14058 review)
  const clientHeight = container?.clientHeight || 12 * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT))
  const visibleCount = Math.max(1, Math.ceil(clientHeight / ROW_HEIGHT))
  const endIndex = Math.min(startIndex + visibleCount, childrenCachedTotalRows.value)

  rowSlice.start = Math.max(0, startIndex - ROW_VIRTUAL_MARGIN)
  rowSlice.end = Math.min(childrenCachedTotalRows.value, endIndex + ROW_VIRTUAL_MARGIN)
}

// Recompute the virtual slice whenever the total OR the set of cached rows changes, AND once
// immediately on mount. `immediate` matters because the list remounts on returning from the
// link-records modal while the chunk cache is still populated — so there's no total/size change
// to react to, and a change-only watch would leave rowSlice at {0,0} until the user scrolls,
// hiding the already-linked persisted rows. `flush: 'post'` runs the callback after the DOM
// updates so the scroll container is mounted and measured when calculateSlices reads it
// (#14058 review).
watch([childrenCachedTotalRows, () => childrenCachedRows.value.size], () => calculateSlices(), {
  flush: 'post',
  immediate: true,
})

const updateVisibleChunks = () => {
  if (childrenCachedTotalRows.value === 0 && childrenCachedRows.value.size === 0) return

  const firstChunk = Math.floor(rowSlice.start / _CHUNK_SIZE)
  const lastChunk = Math.floor(Math.max(0, rowSlice.end - 1) / _CHUNK_SIZE)

  for (let c = firstChunk; c <= lastChunk; c++) {
    fetchChildrenChunk(c)
  }

  const bufferStart = Math.max(0, rowSlice.start - 20)
  const bufferEnd = Math.min(childrenCachedTotalRows.value, rowSlice.end + 20)
  clearChildrenCache(bufferStart, bufferEnd)
}

// Debounce chunk fetching — short delay for normal scroll responsiveness,
// maxWait ensures chunks load within 100ms even during continuous scrolling
const debouncedUpdateVisibleChunks = useDebounceFn(updateVisibleChunks, 50, { maxWait: 100 })

const onListScroll = () => {
  calculateSlices()
  debouncedUpdateVisibleChunks()
}

const visibleRows = computed(() => {
  const { start, end } = rowSlice
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => {
    const idx = start + i
    const row = childrenCachedRows.value.get(idx)
    let isLinked = childrenCachedLinkedState.value.get(idx) ?? true
    const isLoading = childrenCachedLoadingState.value.get(idx) ?? false
    if (!row) return { _placeholder: true, _index: idx, _isLinked: true, _isLoading: false }
    // A persisted row buffered for unlink (deferred) must render as unlinked
    // even after the cache reseeds on reopen / far-chunk load.
    if (shouldDefer.value && !isNew.value && isPendingUnlink(row)) isLinked = false
    return { ...row, _index: idx, _isLinked: isLinked, _isLoading: isLoading }
  })
})

onUnmounted(() => {
  resetChildrenListOffsetCount()
  resetChildrenCache()
  childrenListPagination.query = ''
})

const onFilterChange = () => {
  childrenListPagination.page = 1
  resetChildrenCache()
  // reset offset count when filter changes
  resetChildrenListOffsetCount()
}

const isSearchInputFocused = ref(false)

const { handleSearchKeydown: handleKeyDown } = useLTARListKeyNav({
  scrollContainerRef,
  filterQueryRef,
  itemTestId: 'nc-child-list-item',
  expandedFormDlg,
  closeModal: () => {
    vModel.value = false
  },
  getQuery: () => childrenListPagination.query,
  onEscapeEmptyQuery: () => emit('escape'),
  onEnterWithQuery: () => {
    const list = childrenList.value?.list ?? state.value?.[colTitle.value]
    if (ncIsArray(list) && list.length) linkOrUnLink(list[0], '0')
  },
})
</script>

<template>
  <div class="nc-modal-child-list h-full w-full" :class="{ active: vModel }" @keydown.enter.stop>
    <div class="flex flex-col h-full">
      <div class="nc-dropdown-link-record-header bg-nc-bg-gray-light py-2 rounded-t-xl flex justify-between pl-3 pr-2 gap-2">
        <div class="flex-1 nc-dropdown-link-record-search-wrapper flex items-center rounded-md">
          <!-- Utilize SmartsheetToolbarFilterInput component to filter the records for Date or DateTime column -->
          <SmartsheetToolbarFilterInput
            v-if="relatedTableDisplayValueColumn && isDateOrDateTimeCol(relatedTableDisplayValueColumn)"
            class="nc-filter-value-select rounded-md min-w-34"
            :column="relatedTableDisplayValueColumn"
            :filter="{
              comparison_op: 'eq',
              comparison_sub_op: 'exactDate',
              value: childrenListPagination.query,
            }"
            @update-filter-value="childrenListPagination.query = $event"
            @click.stop
          />
          <a-input
            v-else
            ref="filterQueryRef"
            v-model:value="childrenListPagination.query"
            :bordered="false"
            placeholder="Search linked records..."
            class="w-full min-h-4 !pl-0"
            size="small"
            autocomplete="off"
            @focus="isSearchInputFocused = true"
            @blur="isSearchInputFocused = false"
            @change="onFilterChange"
            @keydown.capture.stop="handleKeyDown"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="nc-search-icon mr-2 h-4 w-4 text-nc-content-gray-muted" />
            </template>
          </a-input>
        </div>
        <LazyVirtualCellComponentsHeader
          data-testid="nc-link-count-info"
          :linked-records="totalItemsToShow"
          :related-table-title="relatedTableMeta?.title"
          :relation="relation"
          :table-title="meta?.title"
        />
      </div>
      <div ref="scrollContainerRef" class="flex-1 overflow-auto nc-scrollbar-thin" @scroll="onListScroll">
        <div v-if="isDataExist || isChildrenLoading || childrenCachedTotalRows > 0 || showPendingLinks">
          <template v-if="isChildrenLoading && childrenCachedRows.size === 0">
            <div
              v-for="(_x, i) in Array.from({ length: skeletonCount })"
              :key="i"
              class="flex flex-row gap-3 px-3 py-2 transition-all relative border-b-1 border-nc-border-gray-medium hover:bg-nc-bg-gray-extralight"
            >
              <div class="flex items-center">
                <a-skeleton-image class="!h-11 !w-11 !rounded-md overflow-hidden children:(!h-full !w-full)" />
              </div>
              <div class="flex flex-col gap-2 flex-grow justify-center">
                <a-skeleton-input active class="h-4 !w-48 !rounded-md overflow-hidden" size="small" />
                <div class="flex flex-row gap-6 w-10/12">
                  <a-skeleton-input
                    v-for="idx of [1, 2, 3]"
                    :key="idx"
                    active
                    class="!h-3 !w-24 !rounded-md overflow-hidden"
                    size="small"
                  />
                </div>
              </div>
            </div>
          </template>
          <!-- Drag-to-reorder branch (v2 mm on PG, small/loaded set): a plain,
               non-virtualized draggable list so the whole set can be arranged. -->
          <template v-else-if="reorderEnabled">
            <Draggable
              v-model="reorderRows"
              :item-key="(r) => getRelatedTableRowId(r)"
              handle=".nc-ltar-reorder-handle"
              ghost-class="nc-ltar-reorder-ghost"
              :animation="150"
              @end="onReorderEnd"
            >
              <template #item="{ element, index }">
                <div
                  class="flex flex-row items-center border-b-1 border-nc-border-gray-medium hover:bg-nc-bg-gray-extralight"
                  data-testid="nc-child-list-reorder-item"
                >
                  <div
                    class="nc-ltar-reorder-handle flex-none flex items-center pl-2 cursor-move text-nc-content-gray-muted hover:text-nc-content-gray"
                    data-testid="nc-child-list-reorder-handle"
                  >
                    <GeneralIcon icon="ncDrag" class="!h-4 !w-4" />
                  </div>
                  <LazyVirtualCellComponentsListItem
                    class="flex-1 min-w-0"
                    :attachment="attachmentCol"
                    :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
                    :fields="fields"
                    :display-value-column="relatedTableDisplayValueColumn"
                    :is-linked="true"
                    :is-loading="false"
                    :related-table-display-value-prop="relatedTableDisplayValueProp"
                    :row="element"
                    :allow-expand="allowRecordExpand"
                    data-testid="nc-child-list-item"
                    @link-or-unlink="unlinkRow(element, index)"
                    @expand="onClick(element)"
                    @close="vModel = false"
                  />
                </div>
              </template>
            </Draggable>
          </template>
          <template v-else>
            <!-- Unsaved (buffered) links — shown above the persisted list until save -->
            <LazyVirtualCellComponentsListItem
              v-for="(pItem, pi) in showPendingLinks ? pendingLinkRows : []"
              :key="`pending-${pi}`"
              :attachment="attachmentCol"
              :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
              :fields="fields"
              :display-value-column="relatedTableDisplayValueColumn"
              :is-linked="true"
              :is-loading="false"
              :related-table-display-value-prop="relatedTableDisplayValueProp"
              :row="pItem"
              :allow-expand="allowRecordExpand"
              data-testid="nc-child-list-item-pending"
              @link-or-unlink="removePendingLink(pItem)"
              @expand="onClick(pItem)"
              @close="vModel = false"
              @keydown.space.prevent.stop="() => removePendingLink(pItem)"
              @keydown.enter.prevent.stop="() => removePendingLink(pItem)"
            />

            <!-- Top spacer for virtual scroll -->
            <div :style="{ height: `${rowSlice.start * ROW_HEIGHT}px` }" />

            <template v-for="item in visibleRows" :key="item._index">
              <!-- Skeleton placeholder for unloaded rows -->
              <div
                v-if="item._placeholder"
                :style="{ height: `${ROW_HEIGHT}px` }"
                class="flex flex-row gap-3 px-3 py-2 transition-all relative border-b-1 border-nc-border-gray-medium"
              >
                <div class="flex items-center">
                  <a-skeleton-image class="!h-11 !w-11 !rounded-md overflow-hidden children:(!h-full !w-full)" />
                </div>
                <div class="flex flex-col gap-2 flex-grow justify-center">
                  <a-skeleton-input active class="h-4 !w-48 !rounded-md overflow-hidden" size="small" />
                </div>
              </div>
              <!-- Actual ListItem for loaded rows -->
              <LazyVirtualCellComponentsListItem
                v-else
                :attachment="attachmentCol"
                :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
                :fields="fields"
                :display-value-column="relatedTableDisplayValueColumn"
                :is-linked="item._isLinked"
                :is-loading="item._isLoading"
                :is-selected="!!(isSearchInputFocused && childrenListPagination.query && item._index === 0)"
                :related-table-display-value-prop="relatedTableDisplayValueProp"
                :row="item"
                :allow-expand="allowRecordExpand"
                data-testid="nc-child-list-item"
                @link-or-unlink="linkOrUnLink(item, String(item._index))"
                @expand="onClick(item)"
                @close="vModel = false"
                @keydown.space.prevent.stop="() => linkOrUnLink(item, String(item._index))"
                @keydown.enter.prevent.stop="() => linkOrUnLink(item, String(item._index))"
              />
            </template>

            <!-- Bottom spacer for virtual scroll -->
            <div :style="{ height: `${Math.max(0, childrenCachedTotalRows - rowSlice.end) * ROW_HEIGHT}px` }" />
          </template>
        </div>
        <div v-else class="h-full flex flex-col gap-2 my-auto items-center justify-center text-nc-content-gray-muted text-center">
          <img
            :alt="$t('msg.clickLinkRecordsToAddLinkFromTable')"
            class="!w-[158px] flex-none"
            src="~assets/img/placeholder/link-records.png"
          />
          <div class="text-base text-nc-content-inverted-secondary font-bold">{{ $t('msg.noLinkedRecords') }}</div>
          <div class="text-nc-content-inverted-secondary">
            {{ $t('msg.clickLinkRecordsToAddLinkFromTable') }}
          </div>

          <NcButton
            v-if="!readOnly && (childrenListCount < 1 || (childrenList?.list ?? state?.[colTitle] ?? []).length > 0)"
            v-e="['c:links:link']"
            data-testid="nc-child-list-button-link-to"
            size="small"
            @click="emit('attachRecord')"
          >
            <div class="flex items-center gap-1"><MdiPlus /> {{ $t('title.linkRecords') }}</div>
          </NcButton>
        </div>
      </div>

      <div
        class="nc-dropdown-link-record-footer bg-nc-bg-gray-light p-2 rounded-b-xl flex items-center justify-between gap-3 min-h-11"
      >
        <div class="flex items-center gap-2">
          <PermissionsTooltip
            v-if="
              allowNewRecord &&
              !readOnly &&
              isLinkedTableAccessible &&
              !isPublic &&
              !isDataReadOnly &&
              !isTemplateMode &&
              isUIAllowed('dataEdit', externalBaseUserRoles) &&
              isUIAllowed('dataEdit') &&
              !isForm &&
              !relatedTableMeta?.synced
            "
            :entity="PermissionEntity.TABLE"
            :entity-id="relatedTableMeta?.id"
            :permission="PermissionKey.TABLE_RECORD_ADD"
          >
            <template #default="{ isAllowed }">
              <NcButton
                v-e="['c:row-expand:open']"
                size="small"
                class="!hover:(bg-nc-bg-default text-nc-content-brand) !h-7 !text-small"
                type="secondary"
                data-testid="nc-child-list-button-new-record"
                :disabled="!isAllowed"
                @click="addNewRecord"
              >
                <div class="flex items-center gap-1">
                  <MdiPlus v-if="!isMobileMode" class="h-4 w-4" /> {{ $t('activity.newRecord') }}
                </div>
              </NcButton>
            </template>
          </PermissionsTooltip>
          <NcButton
            v-if="
              !readOnly &&
              (childrenListCount > 0 || (childrenList?.list ?? state?.[colTitle] ?? []).length > 0) &&
              !(meta?.synced && column?.readonly)
            "
            v-e="['c:links:link']"
            data-testid="nc-child-list-button-link-to"
            class="!hover:(bg-nc-bg-default text-nc-content-brand) !h-7 !text-small"
            size="small"
            type="secondary"
            @click="emit('attachRecord')"
          >
            <div class="flex items-center gap-1">
              <GeneralIcon icon="link2" class="!xs:hidden h-4 w-4" />
              {{ isMobileMode ? $t('title.linkMore') : $t('title.linkMoreRecords') }}
            </div>
          </NcButton>
        </div>
        <div v-if="childrenCachedTotalRows > 0" class="text-nc-content-gray-muted text-small">
          {{ childrenCachedTotalRows }} {{ childrenCachedTotalRows === 1 ? 'record' : 'records' }}
        </div>
      </div>
    </div>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :load-row="!isPublic && !isBlueprintMode"
        :close-after-save="isExpandedFormCloseAfterSave"
        :meta="relatedTableMeta"
        :row="{
          row: expandedFormRow,
          oldRow: expandedFormRow,
          rowMeta: !isNewRecord
            ? {}
            : {
                new: true,
              },
        }"
        :state="isNewRecord ? newRowState : {}"
        :row-id="extractPkFromRow(expandedFormRow, relatedTableMeta.columns as ColumnType[])"
        use-meta-fields
        skip-reload
        maintain-default-view-order
        :blueprint-mode="isBlueprintMode"
        :breadcrumbs="isBlueprintMode ? [...parentBreadcrumbs, meta?.title || ''] : undefined"
        :new-record-submit-btn-text="!isNewRecord ? undefined : isBlueprintMode ? 'Save Record' : 'Create & Link'"
        :new-record-header="
          isBlueprintMode
            ? `New ${relatedTableMeta?.title} Record`
            : isExpandedFormCloseAfterSave
            ? $t('activity.tableNameCreateNewRecord', { tableName: relatedTableMeta?.title })
            : undefined
        "
        @created-record="onCreatedRecord"
        @deleted-record="onDeletedRecord"
      />
    </Suspense>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-nested-list-item .ant-card-body) {
  @apply !px-1 !py-0;
}

:deep(.ant-modal-content) {
  @apply !p-0;
}

:deep(.ant-skeleton-element .ant-skeleton-image-svg) {
  @apply !w-7;
}

:deep(.nc-filter-input-wrapper) {
  height: 28px;
}
</style>

<style lang="scss">
.nc-dropdown-link-record-search-wrapper {
  .nc-search-icon {
    @apply flex-none text-nc-content-gray-muted;
  }

  &:focus-within {
    .nc-search-icon {
      @apply text-nc-content-gray-subtle2;
    }
  }
  input {
    &::placeholder {
      @apply text-nc-content-gray-muted;
    }
  }
}
</style>
