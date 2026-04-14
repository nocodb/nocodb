<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import {
  PermissionEntity,
  PermissionKey,
  RelationTypes,
  isBtLikeV2Junction,
  isDateOrDateTimeCol,
  isLinksOrLTAR,
} from 'nocodb-sdk'
import InboxIcon from '~icons/nc-icons/inbox'

const props = defineProps<{
  modelValue: boolean
  column: any
  hideBackBtn?: boolean
  /** Breadcrumb trail passed from parent (across dropdown teleport boundary) */
  parentBreadcrumbs?: string[]
}>()

const emit = defineEmits(['update:modelValue', 'addNewRecord', 'attachLinkedRecord', 'escape'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const injectedColumn = inject(ColumnInj)

const { isSharedBase } = storeToRefs(useBase())

const filterQueryRef = ref<HTMLInputElement>()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { isDataReadOnly } = useRoles()

const {
  childrenExcludedList,
  isChildrenExcludedListLinked,
  childrenExcludedOffsetCount,
  childrenListOffsetCount,
  isChildrenExcludedLoading,
  childrenListCount,
  loadChildrenExcludedList,
  loadChildrenList,
  childrenExcludedListPagination,
  relatedTableDisplayValueProp,
  displayValueTypeAndFormatProp,
  relatedTableDisplayValueColumn,
  link,
  relatedTableMeta,
  meta,
  unlink,
  row,
  resetChildrenExcludedOffsetCount,
  loadRelatedTableMeta,
  attachmentCol,
  fields,
  refreshCurrentRow,
  rowId,
  externalBaseUserRoles,
  isLinkedTableAccessible,
  // Chunked cache
  CHUNK_SIZE,
  ROW_HEIGHT,
  excludedCachedRows,
  excludedTotalRows,
  excludedLinkedState,
  excludedLoadingState,
  fetchExcludedChunk,
  clearExcludedCache,
  resetExcludedCache,
} = useLTARStoreOrThrow()

const { addLTARRef, isNew, removeLTARRef, state: rowState } = useSmartsheetRowStoreOrThrow()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const isPublic = inject(IsPublicInj, ref(false))

const isTemplateMode = inject(IsTemplateModeInj, ref(false))

// Use prop-based breadcrumbs (injection doesn't work across dropdown teleport boundary)
const parentBreadcrumbs = computed(() => props.parentBreadcrumbs || [])

const isExpandedFormCloseAfterSave = ref(false)

const isNewRecord = ref(false)

const isBlueprintMode = ref(false)

isChildrenExcludedLoading.value = true

const isForm = inject(IsFormInj, ref(false))

const saveRow = inject(SaveRowInj, () => {})

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const injectedRow = inject(RowInj)!

const relation = computed(() => {
  return injectedColumn!.value?.colOptions?.type
})

const isSingleTargetLink = computed(() => {
  return isBtLikeV2Junction(injectedColumn!.value) || relation.value === 'oo' || relation.value === 'bt'
})

const linkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    await addLTARRef(row, injectedColumn?.value as ColumnType)

    // Update the cell value directly on the row so the parent template re-renders
    const colTitle = injectedColumn?.value?.title
    if (colTitle && injectedRow.value) {
      if (isSingleTargetLink.value) {
        injectedRow.value.row[colTitle] = row
      } else {
        if (!Array.isArray(injectedRow.value.row[colTitle])) {
          injectedRow.value.row[colTitle] = []
        }
        injectedRow.value.row[colTitle] = [...(injectedRow.value.row[colTitle] || []), row]
      }
    }

    if (isSingleTargetLink.value) {
      isChildrenExcludedListLinked.value.forEach((isLinked, idx) => {
        if (isLinked) {
          isChildrenExcludedListLinked.value[idx] = false
        }
        if (id === idx) {
          isChildrenExcludedListLinked.value[idx] = true
        }
      })
    } else {
      isChildrenExcludedListLinked.value[id] = true
    }

    saveRow!()

    $e('a:links:link')
  } else {
    await link(row, {}, false, id)
  }
}

const unlinkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    removeLTARRef(row, injectedColumn?.value as ColumnType)
    isChildrenExcludedListLinked.value[id] = false
    saveRow!()
    $e('a:links:unlink')
  } else {
    await unlink(row, {}, false, id)
  }
}

/** reload list on modal open */
watch(
  vModel,
  (nextVal, prevVal) => {
    if (nextVal && !prevVal) {
      refreshCurrentRow()
      /** reset query and limit */
      childrenExcludedListPagination.query = ''
      childrenExcludedListPagination.page = 1
      if (!isForm.value) {
        loadChildrenList()
      }
      loadChildrenExcludedList(rowState.value, true)
    }
    if (!nextVal) {
      resetChildrenExcludedOffsetCount()
    }
  },
  {
    immediate: true,
  },
)

const expandedFormDlg = ref(false)

const expandedFormRow = ref({})

/** populate initial state for a new row which is parent/child of current record */
const newRowState = computed(() => {
  if (isNew.value) return {}
  const colOpt = (injectedColumn?.value as ColumnType)?.colOptions as LinkToAnotherRecordType
  const colInRelatedTable: ColumnType | undefined = relatedTableMeta?.value?.columns?.find((col) => {
    // Links as for the case of 'mm' we need the 'Links' column
    if (!isLinksOrLTAR(col)) return false
    const colOpt1 = col?.colOptions as LinkToAnotherRecordType
    if (colOpt1?.fk_related_model_id !== meta.value.id) return false

    if (colOpt.type === RelationTypes.MANY_TO_MANY && colOpt1?.type === RelationTypes.MANY_TO_MANY) {
      return (
        colOpt.fk_parent_column_id === colOpt1.fk_child_column_id &&
        colOpt.fk_child_column_id === colOpt1.fk_parent_column_id &&
        colOpt.fk_mm_model_id === colOpt1.fk_mm_model_id
      )
    } else {
      return (
        colOpt.fk_parent_column_id === colOpt1.fk_parent_column_id && colOpt.fk_child_column_id === colOpt1.fk_child_column_id
      )
    }
  })
  if (!colInRelatedTable) return {}
  const relatedTableColOpt = colInRelatedTable?.colOptions as LinkToAnotherRecordType
  if (!relatedTableColOpt) return {}

  if (relatedTableColOpt.type === RelationTypes.BELONGS_TO || relatedTableColOpt.type === RelationTypes.ONE_TO_ONE) {
    return {
      [colInRelatedTable.title as string]: row?.value?.row,
    }
  } else {
    return {
      [colInRelatedTable.title as string]: row?.value && [row.value.row],
    }
  }
})

const totalItemsToShow = computed(() => {
  if (isForm.value || isNew.value) {
    if (relation.value === 'bt' || relation.value === 'oo') {
      return rowState.value?.[injectedColumn!.value?.title] ? 1 : 0
    }

    return rowState.value?.[injectedColumn!.value?.title]?.length ?? 0
  }

  if (relation.value === 'bt') {
    return row.value?.row[relatedTableMeta.value?.title] ? 1 : 0
  }

  if (relation.value === 'oo') {
    return row.value?.row[injectedColumn!.value?.title] ? 1 : 0
  }

  return childrenListCount.value ?? 0
})

watch(expandedFormDlg, () => {
  if (!expandedFormDlg.value) {
    isExpandedFormCloseAfterSave.value = false
    if (!isForm.value) {
      loadChildrenList()
    }
    loadChildrenExcludedList(rowState.value)
  }
  childrenExcludedOffsetCount.value = 0
  childrenListOffsetCount.value = 0
})

watch(filterQueryRef, () => {
  // Don't focus input on open dropdown in mobile mode
  if (isMobileMode.value) return

  filterQueryRef.value?.focus()
})

const onClick = (refRow: any, id: string) => {
  if (isSharedBase.value) return
  if (isChildrenExcludedListLinked.value[Number.parseInt(id)]) {
    unlinkRow(refRow, Number.parseInt(id))
  } else {
    linkRow(refRow, Number.parseInt(id))
  }
}

const addNewRecord = () => {
  if (showRecordPlanLimitExceededModal()) return
  // Don't allow creating new record if linked table is not accessible
  if (!isLinkedTableAccessible.value) return

  expandedFormRow.value = {}
  expandedFormDlg.value = true
  isExpandedFormCloseAfterSave.value = true
  isNewRecord.value = true
  isBlueprintMode.value = false
}

const onCreatedRecord = (record: any) => {
  // Blueprint mode: store the record data as a blueprint in ltarState (no real record created)
  if (isBlueprintMode.value) {
    const blueprint = { ...record, _isBlueprint: true }
    addLTARRef(blueprint, injectedColumn?.value as ColumnType)
    loadChildrenList(false, rowState.value)
    isBlueprintMode.value = false
    isNewRecord.value = false
    vModel.value = false
    return
  }

  addLTARRef(record, injectedColumn?.value as ColumnType)

  reloadTrigger?.trigger({
    shouldShowLoading: false,
  })
  reloadViewDataTrigger?.trigger({
    shouldShowLoading: false,
    isFromLinkRecord: true,
    relatedTableMetaId: relatedTableMeta.value.id,
    rowId: rowId.value!,
  })

  if (!isNewRecord.value) {
    vModel.value = false

    return
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

  vModel.value = false
  isNewRecord.value = false
}

const onDeletedRecord = async () => {
  await loadChildrenList()
  loadChildrenExcludedList(rowState.value, true)
}

const linkedShortcuts = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    vModel.value = false
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    try {
      e.target?.nextElementSibling?.focus()
    } catch (e) {}
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    try {
      e.target?.previousElementSibling?.focus()
    } catch (e) {}
  } else if (!expandedFormDlg.value && e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Enter' && e.key !== ' ') {
    try {
      filterQueryRef.value?.focus()
    } catch (e) {}
  }
}

const scrollContainerRef = ref<HTMLElement>()

const ROW_VIRTUAL_MARGIN = 5

const rowSlice = reactive({ start: 0, end: 0 })

const calculateSlices = () => {
  const container = scrollContainerRef.value
  if (!container || excludedTotalRows.value === 0) return

  const scrollTop = container.scrollTop
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT))
  const visibleCount = Math.ceil(container.clientHeight / ROW_HEIGHT)
  const endIndex = Math.min(startIndex + visibleCount, excludedTotalRows.value)

  rowSlice.start = Math.max(0, startIndex - ROW_VIRTUAL_MARGIN)
  rowSlice.end = Math.min(excludedTotalRows.value, endIndex + ROW_VIRTUAL_MARGIN)
}

// Recalculate slices when totalRows changes (e.g., after first chunk load)
watch(excludedTotalRows, () => {
  calculateSlices()
})

const updateVisibleChunks = () => {
  if (excludedTotalRows.value === 0 && excludedCachedRows.value.size === 0) return

  const firstChunk = Math.floor(rowSlice.start / CHUNK_SIZE)
  const lastChunk = Math.floor(Math.max(0, rowSlice.end - 1) / CHUNK_SIZE)

  for (let c = firstChunk; c <= lastChunk; c++) {
    fetchExcludedChunk(c)
  }

  // Evict chunks outside buffer
  const bufferStart = Math.max(0, rowSlice.start - 20)
  const bufferEnd = Math.min(excludedTotalRows.value, rowSlice.end + 20)
  clearExcludedCache(bufferStart, bufferEnd)
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
    const row = excludedCachedRows.value.get(idx)
    const isLinked = excludedLinkedState.value.get(idx) ?? false
    const isLoading = excludedLoadingState.value.get(idx) ?? false
    if (!row) return { _placeholder: true, _index: idx, _isLinked: false, _isLoading: false }
    return { ...row, _index: idx, _isLinked: isLinked, _isLoading: isLoading }
  })
})

onMounted(() => {
  window.addEventListener('keydown', linkedShortcuts)
  loadRelatedTableMeta()

  // Load initial chunk
  fetchExcludedChunk(0)

  // Don't focus input on open dropdown in mobile mode
  if (isMobileMode.value) return
  setTimeout(() => {
    filterQueryRef.value?.focus()
  }, 100)
})

onUnmounted(() => {
  resetChildrenExcludedOffsetCount()
  resetExcludedCache()
  childrenExcludedListPagination.query = ''
  window.removeEventListener('keydown', linkedShortcuts)
})

const onFilterChange = () => {
  childrenExcludedListPagination.page = 1
  resetChildrenExcludedOffsetCount()
  resetExcludedCache()
  // Fetch first chunk with new query (watcher handles API call via debounce)
}

const isSearchInputFocused = ref(false)

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (!childrenExcludedListPagination.query) emit('escape')
    filterQueryRef.value?.blur()
  } else if (e.key === 'Enter') {
    if (
      childrenExcludedListPagination.query &&
      ncIsArray(childrenExcludedList.value?.list) &&
      childrenExcludedList.value?.list.length
    ) {
      onClick(childrenExcludedList.value?.list[0], '0')
    }
  }
}
</script>

<template>
  <div class="nc-modal-link-record h-full w-full overflow-hidden" :class="{ active: vModel }" @keydown.enter.stop>
    <div class="flex flex-col h-full">
      <div class="nc-dropdown-link-record-header bg-nc-bg-gray-light py-2 rounded-t-xl flex justify-between pl-3 pr-2 gap-2">
        <div class="flex-1 gap-2 flex items-center">
          <button
            v-if="!hideBackBtn"
            class="!text-nc-content-brand hover:!text-nc-brand-700 p-1.5 flex"
            @click="emit('attachLinkedRecord')"
          >
            <GeneralIcon icon="ncArrowLeft" class="flex-none h-4 w-4" />
          </button>

          <div class="flex-1 nc-dropdown-link-record-search-wrapper flex items-center rounded-md">
            <!-- Utilize SmartsheetToolbarFilterInput component to filter the records for Date or DateTime column -->
            <SmartsheetToolbarFilterInput
              v-if="relatedTableDisplayValueColumn && isDateOrDateTimeCol(relatedTableDisplayValueColumn)"
              class="nc-filter-value-select rounded-md min-w-34"
              :column="relatedTableDisplayValueColumn"
              :filter="{
                comparison_op: 'eq',
                comparison_sub_op: 'exactDate',
                value: childrenExcludedListPagination.query,
              }"
              @update-filter-value="childrenExcludedListPagination.query = $event"
              @click.stop
            />
            <a-input
              v-else
              ref="filterQueryRef"
              v-model:value="childrenExcludedListPagination.query"
              :bordered="false"
              placeholder="Search records to link..."
              class="w-full nc-excluded-search min-h-4 !pl-0"
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
        <template v-if="excludedTotalRows > 0 || isChildrenExcludedLoading">
          <template v-if="isChildrenExcludedLoading && excludedCachedRows.size === 0">
            <div
              v-for="(_x, i) in Array.from({ length: 10 })"
              :key="i"
              class="flex flex-row gap-3 px-3 py-2 transition-all relative border-b-1 border-nc-border-gray-medium hover:c"
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
          <template v-else>
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
                :display-value-column="relatedTableDisplayValueColumn"
                :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
                :fields="fields"
                :is-linked="item._isLinked"
                :is-loading="item._isLoading"
                :is-selected="!!(isSearchInputFocused && childrenExcludedListPagination.query && item._index === 0)"
                :related-table-display-value-prop="relatedTableDisplayValueProp"
                :row="item"
                data-testid="nc-excluded-list-item"
                @link-or-unlink="onClick(item, String(item._index))"
                @expand="
                  () => {
                    if (!isLinkedTableAccessible) return
                    expandedFormRow = item
                    expandedFormDlg = true
                  }
                "
                @keydown.space.prevent.stop="() => onClick(item, String(item._index))"
                @keydown.enter.prevent.stop="() => onClick(item, String(item._index))"
              />
            </template>

            <!-- Bottom spacer for virtual scroll -->
            <div :style="{ height: `${Math.max(0, excludedTotalRows - rowSlice.end) * ROW_HEIGHT}px` }" />
          </template>
        </template>
        <div v-else class="h-full my-auto py-2 flex flex-col gap-3 items-center justify-center text-nc-content-gray-muted">
          <InboxIcon class="w-16 h-16 mx-auto" />

          <p v-if="childrenExcludedListPagination.query" class="mb-0">{{ $t('msg.noRecordsMatchYourSearchQuery') }}</p>
          <p v-else class="mb-0">
            {{ $t('msg.noRecordsAvailForLinking') }}
          </p>
          <div class="flex">
            <PermissionsTooltip
              v-if="
                !isPublic &&
                !isDataReadOnly &&
                !isTemplateMode &&
                isUIAllowed('dataEdit', externalBaseUserRoles) &&
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
                  :disabled="!isAllowed"
                  @click="addNewRecord"
                >
                  <div class="flex items-center gap-1"><MdiPlus v-if="!isMobileMode" /> {{ $t('activity.newRecord') }}</div>
                </NcButton>
              </template>
            </PermissionsTooltip>
          </div>
        </div>
      </div>
      <div class="nc-dropdown-link-record-footer bg-nc-bg-gray-light p-2 rounded-b-xl flex items-center justify-between min-h-11">
        <div class="flex">
          <PermissionsTooltip
            v-if="
              !isPublic &&
              !isDataReadOnly &&
              !isTemplateMode &&
              isUIAllowed('dataEdit', externalBaseUserRoles) &&
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
                :disabled="!isAllowed"
                @click="addNewRecord"
              >
                <div class="flex items-center gap-1"><MdiPlus v-if="!isMobileMode" /> {{ $t('activity.newRecord') }}</div>
              </NcButton>
            </template>
          </PermissionsTooltip>
        </div>
        <div v-if="excludedTotalRows > 0" class="text-nc-content-gray-muted text-small">
          {{ excludedTotalRows }} {{ excludedTotalRows === 1 ? 'record' : 'records' }}
        </div>
      </div>
    </div>
    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormDlg"
        v-model="expandedFormDlg"
        :load-row="!isPublic && !isBlueprintMode"
        :close-after-save="isExpandedFormCloseAfterSave"
        :meta="relatedTableMeta"
        :new-record-header="
          isBlueprintMode
            ? `New ${relatedTableMeta?.title} Record`
            : isExpandedFormCloseAfterSave
            ? $t('activity.tableNameCreateNewRecord', { tableName: relatedTableMeta?.title })
            : undefined
        "
        :row="{
          row: expandedFormRow,
          oldRow: {},
          rowMeta: !isNewRecord
            ? {}
            : {
                new: true,
              },
        }"
        :row-id="extractPkFromRow(expandedFormRow, relatedTableMeta.columns as ColumnType[])"
        :state="newRowState"
        :blueprint-mode="isBlueprintMode"
        :breadcrumbs="isBlueprintMode ? [...parentBreadcrumbs, meta?.title || ''] : undefined"
        use-meta-fields
        maintain-default-view-order
        skip-reload
        :new-record-submit-btn-text="!isNewRecord ? undefined : isBlueprintMode ? 'Save Record' : 'Create & Link'"
        @deleted-record="onDeletedRecord"
        @created-record="onCreatedRecord"
      />
    </Suspense>
  </div>
</template>

<style lang="scss" scoped>
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
