<script lang="ts" setup>
import { type ColumnType, type LinkToAnotherRecordType, isDateOrDateTimeCol } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'

interface Prop {
  modelValue?: boolean
  cellValue: any
  column: any
  items: number
  /** Breadcrumb trail passed from parent (across dropdown teleport boundary) */
  parentBreadcrumbs?: string[]
}

const props = defineProps<Prop>()

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
} = useLTARStoreOrThrow()

const { withLoading } = useLoadingTrigger()

const { isNew, state, removeLTARRef, addLTARRef } = useSmartsheetRowStoreOrThrow()

const { showRecordPlanLimitExceededModal } = useEeConfig()

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
    await removeLTARRef(row, injectedColumn?.value as ColumnType)
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

  if (relatedTableColOpt.type === RelationTypes.BELONGS_TO) {
    return {
      [colInRelatedTable.title as string]: row?.value?.row,
    }
  } else {
    return {
      [colInRelatedTable.title as string]: row?.value && [row.value.row],
    }
  }
})

const colTitle = computed(() => injectedColumn.value?.title || '')

const onClick = (row: Row) => {
  if (isPublic.value || isForm.value) return
  // Don't allow expanding if linked table is not accessible
  if (!isLinkedTableAccessible.value) return
  expandedFormRow.value = row
  expandedFormDlg.value = true
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

function focusListItemByIndex(idx: number) {
  const items = scrollContainerRef.value
    ? Array.from(scrollContainerRef.value.querySelectorAll<HTMLElement>('[data-testid="nc-child-list-item"]'))
    : []
  const wrapper = items[idx]
  const focusable = wrapper?.querySelector<HTMLElement>('[tabindex="0"]') ?? wrapper
  focusable?.focus()
}

function linkedShortcuts(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    vModel.value = false
    return
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const target = e.target as HTMLElement | null
    const currentWrapper = target?.closest<HTMLElement>('[data-testid="nc-child-list-item"]')
    if (!currentWrapper || !scrollContainerRef.value) return

    e.preventDefault()

    const items = Array.from(scrollContainerRef.value.querySelectorAll<HTMLElement>('[data-testid="nc-child-list-item"]'))
    const idx = items.indexOf(currentWrapper)
    if (idx === -1) return

    if (e.key === 'ArrowDown') {
      if (idx < items.length - 1) focusListItemByIndex(idx + 1)
    } else if (e.key === 'ArrowUp') {
      if (idx === 0) filterQueryRef.value?.focus()
      else focusListItemByIndex(idx - 1)
    }
    return
  }

  if (!expandedFormDlg.value && e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Enter' && e.key !== ' ') {
    try {
      filterQueryRef.value?.focus()
    } catch (e) {}
  }
}

onMounted(() => {
  loadRelatedTableMeta()
  window.addEventListener('keydown', linkedShortcuts)

  // Load initial chunk for virtual scroll
  fetchChildrenChunk(0)

  // Don't focus input on open dropdown in mobile mode
  if (isMobileMode.value) return
  setTimeout(() => {
    filterQueryRef.value?.focus()
  }, 100)
})

const scrollContainerRef = ref<HTMLElement>()

const ROW_VIRTUAL_MARGIN = 5

const rowSlice = reactive({ start: 0, end: 0 })

const calculateSlices = () => {
  const container = scrollContainerRef.value
  if (!container || childrenCachedTotalRows.value === 0) return

  const scrollTop = container.scrollTop
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT))
  const visibleCount = Math.ceil(container.clientHeight / ROW_HEIGHT)
  const endIndex = Math.min(startIndex + visibleCount, childrenCachedTotalRows.value)

  rowSlice.start = Math.max(0, startIndex - ROW_VIRTUAL_MARGIN)
  rowSlice.end = Math.min(childrenCachedTotalRows.value, endIndex + ROW_VIRTUAL_MARGIN)
}

// Recalculate slices when totalRows changes (e.g., after first chunk load)
watch(childrenCachedTotalRows, () => {
  calculateSlices()
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
    const isLinked = childrenCachedLinkedState.value.get(idx) ?? true
    const isLoading = childrenCachedLoadingState.value.get(idx) ?? false
    if (!row) return { _placeholder: true, _index: idx, _isLinked: true, _isLoading: false }
    return { ...row, _index: idx, _isLinked: isLinked, _isLoading: isLoading }
  })
})

onUnmounted(() => {
  resetChildrenListOffsetCount()
  resetChildrenCache()
  childrenListPagination.query = ''
  window.removeEventListener('keydown', linkedShortcuts)
})

const onFilterChange = () => {
  childrenListPagination.page = 1
  resetChildrenCache()
  // reset offset count when filter changes
  resetChildrenListOffsetCount()
}

const isSearchInputFocused = ref(false)

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (!childrenListPagination.query) emit('escape')
    filterQueryRef.value?.blur()
  } else if (e.key === 'Enter') {
    const list = childrenList.value?.list ?? state.value?.[colTitle.value]

    if (childrenListPagination.query && ncIsArray(list) && list.length) {
      linkOrUnLink(list[0], '0')
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusListItemByIndex(0)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
  }
}
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
        <div v-if="isDataExist || isChildrenLoading || childrenCachedTotalRows > 0">
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
                :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
                :fields="fields"
                :display-value-column="relatedTableDisplayValueColumn"
                :is-linked="item._isLinked"
                :is-loading="item._isLoading"
                :is-selected="!!(isSearchInputFocused && childrenListPagination.query && item._index === 0)"
                :related-table-display-value-prop="relatedTableDisplayValueProp"
                :row="item"
                data-testid="nc-child-list-item"
                @link-or-unlink="linkOrUnLink(item, String(item._index))"
                @expand="onClick(item)"
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
        :state="newRowState"
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
