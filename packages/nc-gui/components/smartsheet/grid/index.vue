<script lang="ts" setup>
import type { ColumnType, GridType } from 'nocodb-sdk'
import { isSmartText } from 'nocodb-sdk'
import InfiniteTable from './InfiniteTable.vue'
import Table from './Table.vue'
import CanvasTable from './canvas/index.vue'
import GroupBy from './GroupBy.vue'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const router = useRouter()

const route = router.currentRoute

const { xWhere, eventBus, isExternalSource } = useSmartsheetStoreOrThrow()

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { blockExternalSourceRecordVisibility, showUpgradeToSeeMoreRecordsModal } = useEeConfig()

// --- Expanded form panel (right-side slide-in) ---
const expandedFormPanelStore = useProvideExpandedFormPanel()

const { isOpen: isExpandedFormPanelOpen, rowNavigator: expandedFormPanelRowNavigator } = expandedFormPanelStore

const bulkUpdateDlg = ref(false)

const routeQuery = computed(() => route.value.query as Record<string, string>)

const expandedFormRef = ref()
const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()

const reloadVisibleDataHook = createEventHook()

provide(ReloadVisibleDataHookInj, reloadVisibleDataHook)

const tableRef = ref<typeof InfiniteTable>()

useProvideViewAggregate(view, meta, xWhere, reloadVisibleDataHook)

const smartTextStore = useProvideSmartText()

const { rowNavigator: smartTextRowNavigator } = smartTextStore

const {
  loadData,
  selectedRows: _selectedRows,
  updateOrSaveRow,
  addEmptyRow: _addEmptyRow,
  deleteRow,
  deleteSelectedRows,
  cachedRows,
  clearCache,
  removeRowIfNew,
  navigateToSiblingRow,
  deleteRangeOfRows,
  bulkUpdateRows,
  bulkUpsertRows,
  syncCount,
  totalRows,
  actualTotalRows,
  syncVisibleData,
  optimisedQuery,
  isLastRow,
  isFirstRow,
  chunkStates,
  updateRecordOrder,
  clearInvalidRows,
  isRowSortRequiredRows,
  applySorting,
  isBulkOperationInProgress,
  selectedAllRecords,
  selectedAllRecordsSkipPks,
  bulkDeleteAll,
  getRows,
  getDataCache,
  cachedGroups,
  groupByColumns,
  groupSyncCount,
  fetchMissingGroupChunks,
  toggleExpand,
  totalGroups,
  clearGroupCache,
  toggleExpandAll,
  groupDataCache,
} = useGridViewData(meta, view, xWhere, reloadVisibleDataHook)

// SmartText panel row navigation contract.
smartTextRowNavigator.value = {
  getRow: (index: number) => {
    const row = cachedRows.value.get(index)
    if (!row) return null
    const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
    if (!rowId) return null
    return { rowId, rowData: row.row }
  },
  totalRows: () => totalRows.value,
}

// Deep-link sync: when ?rowId + ?colId both point at a SmartText column, open
// the panel. The colId is treated as a generic cell-deep-link param — only
// SmartText reacts to it for now; other column types fall through to the
// expanded record dialog (which gates on rowId alone).
const _findRowInCache = (rowId: string) => {
  for (const [idx, row] of cachedRows.value.entries()) {
    const id = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
    if (id === rowId) return { idx, rowData: row.row }
  }
  return null
}

watch(
  [() => route.value.query, () => cachedRows.value.size, () => meta.value?.columns?.length],
  ([q]) => {
    const rowId = q.rowId as string | undefined
    const colId = q.colId as string | undefined

    if (!rowId || !colId) {
      if (smartTextStore.isOpen.value) smartTextStore.closeEditor()
      return
    }

    const col = meta.value?.columns?.find((c) => c.id === colId) as ColumnType | undefined
    if (!col || !isSmartText(col)) {
      // Not a SmartText cell — leave to other surfaces (e.g. expanded record).
      if (smartTextStore.isOpen.value) smartTextStore.closeEditor()
      return
    }

    if (
      smartTextStore.isOpen.value &&
      smartTextStore.activeRowId.value === rowId &&
      smartTextStore.activeColumnId.value === colId
    ) {
      // Already showing this cell — sync fullscreen if it diverged, and
      // backfill row context if the row has since arrived in cache (deep-link
      // open often happens before the grid finishes loading).
      const wantFs = q.cellMode === 'fullscreen'
      if (smartTextStore.isFullscreen.value !== wantFs) smartTextStore.setFullscreen(wantFs)

      if (smartTextStore.activeRowIndex.value == null) {
        const found = _findRowInCache(rowId)
        if (found) smartTextStore.setRowContext(found.idx, found.rowData)
      }
      return
    }

    const found = _findRowInCache(rowId)
    smartTextStore.openEditor(rowId, colId, found?.rowData, found?.idx)
    if (q.cellMode === 'fullscreen') smartTextStore.setFullscreen(true)
  },
  { immediate: true },
)

const rowHeight = computed(() => {
  const gridView = view.value?.view as GridType
  if (gridView?.row_height !== undefined) {
    switch (gridView?.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
      default:
        return 1
    }
  }
})

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(true))

provide(IsCalendarInj, ref(false))

provide(RowHeightInj, rowHeight)

const isPublic = inject(IsPublicInj, ref(false))

provide(ReloadRowDataHookInj, reloadViewDataHook)

const skipRowRemovalOnCancel = ref(false)

function updateRowIdRoute(rowId: string, path: Array<number> = []) {
  const routeParams = {
    query: {
      ...routeQuery.value,
      rowId,
      // Clear cell deep-link params — explicit expand always wins over the
      // SmartText panel claim.
      colId: undefined,
      cellMode: undefined,
      path: ncIsEmptyArray(path) ? undefined : path.join('-'),
      expand: undefined,
    },
  }
  if (routeQuery.value.expand) {
    router.replace(routeParams)
  } else {
    router.push(routeParams)
  }
}

function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false, path: Array<number> = []) {
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])

  if (isEeUI && !isMobileMode.value && !isPublic.value && rowId) {
    expandedFormPanelStore.openPanel(row, undefined, state)
    updateRowIdRoute(rowId, path)
    return
  }

  expandedFormRowState.value = state
  if (rowId && !isPublic.value) {
    expandedFormRow.value = undefined
    updateRowIdRoute(rowId, path)
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
    skipRowRemovalOnCancel.value = !fromToolbar
  }
}

const exposeOpenColumnCreate = (data: any) => {
  tableRef.value?.openColumnCreate(data)
}

defineExpose({
  loadData,
  openColumnCreate: exposeOpenColumnCreate,
})

const expandedFormOnRowIdDlg = computed({
  get() {
    if (!routeQuery.value.rowId) return false
    // When the side panel is open, don't trigger the modal
    if (isExpandedFormPanelOpen.value) return false
    // When ?colId points at a SmartText column the SmartText panel claims
    // the URL — expanded record dialog stays closed.
    const colId = routeQuery.value.colId
    if (colId) {
      const col = meta.value?.columns?.find((c) => c.id === colId) as ColumnType | undefined
      if (col && isSmartText(col)) return false
    }
    return true
  },
  set(val) {
    if (!val) {
      router.push({
        query: {
          ...routeQuery.value,
          path: undefined,
          rowId: undefined,
        },
      })
    }
  },
})

// Close panel when route rowId is cleared (e.g. browser back)
watch(
  () => routeQuery.value.rowId,
  (newRowId) => {
    if (!newRowId && isExpandedFormPanelOpen.value) {
      expandedFormPanelStore.closePanel()
    }
  },
)

const addRowExpandOnClose = (row: Row) => {
  if (!skipRowRemovalOnCancel.value) {
    eventBus.emit(SmartsheetStoreEvents.CLEAR_NEW_ROW, row)
  }
}

const toggleOptimisedQuery = () => {
  if (optimisedQuery.value) {
    optimisedQuery.value = false
    message.info(t('msg.optimizedQueryDisabled'))
  } else {
    optimisedQuery.value = true
    message.info(t('msg.optimizedQueryEnabled'))
  }
}

const sidebarStore = useSidebarStore()

const { windowSize, leftSidebarWidth } = toRefs(sidebarStore)

const viewWidth = ref(0)

const smartsheetEvents = (event: SmartsheetStoreEvents) => {
  if (event === SmartsheetStoreEvents.GROUP_BY_RELOAD || event === SmartsheetStoreEvents.DATA_RELOAD) {
    reloadViewDataHook?.trigger()
  }
}

eventBus.on(smartsheetEvents)

onBeforeUnmount(() => {
  eventBus.off(smartsheetEvents)
})

const goToNextRow = () => {
  navigateToSiblingRow(NavigateDir.NEXT)
}

const goToPreviousRow = () => {
  navigateToSiblingRow(NavigateDir.PREV)
}

const updateViewWidth = () => {
  if (isPublic.value) {
    viewWidth.value = windowSize.value
    return
  }
  viewWidth.value = windowSize.value - leftSidebarWidth.value
}

const isInfiniteScrollingEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.INFINITE_SCROLLING))

expandedFormPanelRowNavigator.value = {
  getRow: (index: number) => {
    const row = isInfiniteScrollingEnabled.value ? cachedRows.value.get(index) : pData.value[index]
    if (!row) return null
    const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
    if (!rowId) return null
    return { rowId, row }
  },
  totalRows: () => (isInfiniteScrollingEnabled.value ? totalRows.value ?? 0 : pData.value.length),
}

const isCanvasTableEnabled = computed(() => !ncIsPlaywright())

const isCanvasGroupByTableEnabled = computed(
  () => !ncIsPlaywright() && !blockExternalSourceRecordVisibility(isExternalSource.value),
)

watch([windowSize, leftSidebarWidth], updateViewWidth)

onMounted(() => {
  updateViewWidth()
})

const {
  selectedAllRecords: pSelectedAllRecords,
  formattedData: pData,
  paginationData: pPaginationData,
  loadData: pLoadData,
  changePage: pChangePage,
  aggCommentCount: pAggCommentCount,
  addEmptyRow: pAddEmptyRow,
  deleteRow: pDeleteRow,
  updateOrSaveRow: pUpdateOrSaveRow,
  deleteSelectedRows: pDeleteSelectedRows,
  deleteRangeOfRows: pDeleteRangeOfRows,
  bulkUpdateRows: pBulkUpdateRows,
  removeRowIfNew: pRemoveRowIfNew,
  isFirstRow: pisFirstRow,
  islastRow: pisLastRow,
  getExpandedRowIndex: pGetExpandedRowIndex,
  navigateToSiblingRow: pNavigateToSiblingRow,
} = useViewData(meta, view, xWhere)

const {
  isGroupBy,
  rootGroup,
  loadGroupData,
  loadGroups,
  loadGroupPage,
  groupWrapperChangePage,
  loadGroupAggregation,
  groupBy,
  redistributeRows,
  loadDisallowedLookups,
} = useViewGroupByOrThrow()

const baseColor = computed(() => {
  switch (groupBy.value.length) {
    case 1:
      return 'var(--color-gray-50)'
    case 2:
      return 'var(--color-gray-100)'
    case 3:
      return 'var(--color-gray-200)'
    default:
      return 'var(--color-gray-50)'
  }
})

const updateRowCommentCount = (count: number) => {
  if (!routeQuery.value.rowId) return

  if (isInfiniteScrollingEnabled.value) {
    // In group-by mode rows live in per-group caches (groupDataCache);
    // in non-group mode they live in the root cache. Search the right set.
    const rowCaches = isGroupBy.value ? Array.from(groupDataCache.value.values()).map((g) => g.cachedRows) : [cachedRows]

    for (const cache of rowCaches) {
      for (const row of cache.value.values()) {
        if (extractPkFromRow(row.row, meta.value!.columns!) === routeQuery.value.rowId) {
          row.rowMeta.commentCount = count
          syncVisibleData?.()
          return
        }
      }
    }
  } else {
    const aggCommentCountIndex = pAggCommentCount.value.findIndex((row) => row.row_id === routeQuery.value.rowId)

    const currentRowIndex = pData.value.findIndex(
      (row) => extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) === routeQuery.value.rowId,
    )

    if (currentRowIndex === -1) return

    if (aggCommentCountIndex === -1) {
      pAggCommentCount.value.push({
        row_id: routeQuery.value.rowId,
        count,
      })

      pData.value[currentRowIndex]!.rowMeta.commentCount = count

      return
    }

    if (Number(pAggCommentCount.value[aggCommentCountIndex].count) === count) return
    pAggCommentCount.value[aggCommentCountIndex].count = count
    pData.value[currentRowIndex].rowMeta.commentCount = count
  }
}

const validateExternalSourceRecordVisibility = (page: number, callback?: () => void) => {
  if (
    (pPaginationData.value?.pageSize ?? 25) * page > 100 &&
    showUpgradeToSeeMoreRecordsModal({ isExternalSource: isExternalSource.value })
  ) {
    return true
  }

  callback?.()
}

const pGoToNextRow = () => {
  const currentIndex = pGetExpandedRowIndex()

  if (
    !pPaginationData.value.isLastPage &&
    currentIndex === (pPaginationData.value.pageSize ?? 25) - 1 &&
    validateExternalSourceRecordVisibility(pPaginationData.value?.page ? pPaginationData.value?.page + 1 : 1)
  ) {
    expandedFormRef.value?.stopLoading?.()
    return
  }

  pNavigateToSiblingRow(NavigateDir.NEXT)
}

const pGoToPreviousRow = () => {
  pNavigateToSiblingRow(NavigateDir.PREV)
}

const groupPath = ref([])

const selectedRows = computed(() => {
  const dataCache = getDataCache(groupPath.value)
  return dataCache?.selectedRows.value
})

const bulkUpdateTrigger = (path: Array<number>) => {
  groupPath.value = path
  bulkUpdateDlg.value = true
}

watch([() => view.value?.id, () => meta.value?.columns], async () => {
  await loadDisallowedLookups()
})
</script>

<template>
  <div
    class="relative flex flex-row h-full min-h-0 w-full overflow-hidden nc-grid-wrapper"
    data-testid="nc-grid-wrapper"
    :style="`background-color: ${isGroupBy && !isCanvasGroupByTableEnabled ? `${baseColor}` : 'var(--nc-bg-gray-extralight)'};`"
  >
    <div class="flex flex-col flex-1 min-w-0 h-full">
      <Table
        v-if="!isGroupBy && !isInfiniteScrollingEnabled"
        ref="tableRef"
        v-model:selected-all-records="pSelectedAllRecords"
        :data="pData"
        :pagination-data="pPaginationData"
        :load-data="pLoadData"
        :change-page="(p: number) => validateExternalSourceRecordVisibility(p, ()=> pChangePage(p))"
        :call-add-empty-row="pAddEmptyRow"
        :delete-row="pDeleteRow"
        :update-or-save-row="pUpdateOrSaveRow"
        :delete-selected-rows="pDeleteSelectedRows"
        :delete-range-of-rows="pDeleteRangeOfRows"
        :bulk-update-rows="pBulkUpdateRows"
        :expand-form="expandForm"
        :remove-row-if-new="pRemoveRowIfNew"
        :row-height-enum="rowHeight"
        @toggle-optimised-query="toggleOptimisedQuery"
        @bulk-update-dlg="bulkUpdateDlg = true"
      />

      <CanvasTable
        v-else-if="
          isInfiniteScrollingEnabled && ((isCanvasTableEnabled && !isGroupBy) || (isCanvasGroupByTableEnabled && isGroupBy))
        "
        ref="tableRef"
        v-model:selected-all-records="selectedAllRecords"
        v-model:selected-all-records-skip-pks="selectedAllRecordsSkipPks"
        :load-data="loadData"
        :call-add-empty-row="_addEmptyRow"
        :delete-row="deleteRow"
        :update-or-save-row="updateOrSaveRow"
        :delete-selected-rows="deleteSelectedRows"
        :delete-range-of-rows="deleteRangeOfRows"
        :apply-sorting="applySorting"
        :bulk-update-rows="bulkUpdateRows"
        :bulk-upsert-rows="bulkUpsertRows"
        :update-record-order="updateRecordOrder"
        :bulk-delete-all="bulkDeleteAll"
        :clear-cache="clearCache"
        :clear-invalid-rows="clearInvalidRows"
        :data="cachedRows"
        :total-rows="totalRows"
        :actual-total-rows="actualTotalRows"
        :sync-count="syncCount"
        :get-rows="getRows"
        :chunk-states="chunkStates"
        :expand-form="expandForm"
        :remove-row-if-new="removeRowIfNew"
        :row-height-enum="rowHeight"
        :selected-rows="selectedRows"
        :row-sort-required-rows="isRowSortRequiredRows"
        :total-groups="totalGroups"
        :get-data-cache="getDataCache"
        :cached-groups="cachedGroups"
        :group-by-columns="groupByColumns"
        :group-data-cache="groupDataCache"
        :clear-group-cache="clearGroupCache"
        :toggle-expand="toggleExpand"
        :group-sync-count="groupSyncCount"
        :fetch-missing-group-chunks="fetchMissingGroupChunks"
        :is-bulk-operation-in-progress="isBulkOperationInProgress"
        :toggle-expand-all="toggleExpandAll"
        @toggle-optimised-query="toggleOptimisedQuery"
        @bulk-update-dlg="bulkUpdateTrigger"
      />

      <InfiniteTable
        v-else-if="!isGroupBy"
        ref="tableRef"
        v-model:selected-all-records="selectedAllRecords"
        v-model:selected-all-records-skip-pks="selectedAllRecordsSkipPks"
        :load-data="loadData"
        :call-add-empty-row="_addEmptyRow"
        :delete-row="deleteRow"
        :update-or-save-row="updateOrSaveRow"
        :delete-selected-rows="deleteSelectedRows"
        :delete-range-of-rows="deleteRangeOfRows"
        :apply-sorting="applySorting"
        :bulk-update-rows="bulkUpdateRows"
        :bulk-upsert-rows="bulkUpsertRows"
        :get-rows="getRows"
        :update-record-order="updateRecordOrder"
        :bulk-delete-all="bulkDeleteAll"
        :clear-cache="clearCache"
        :clear-invalid-rows="clearInvalidRows"
        :data="cachedRows"
        :total-rows="totalRows"
        :actual-total-rows="actualTotalRows"
        :sync-count="syncCount"
        :chunk-states="chunkStates"
        :expand-form="expandForm"
        :remove-row-if-new="removeRowIfNew"
        :row-height-enum="rowHeight"
        :selected-rows="selectedRows"
        :row-sort-required-rows="isRowSortRequiredRows"
        :is-bulk-operation-in-progress="isBulkOperationInProgress"
        @toggle-optimised-query="toggleOptimisedQuery"
        @bulk-update-dlg="bulkUpdateDlg = true"
      />

      <GroupBy
        v-else
        :group="rootGroup"
        :load-groups="loadGroups"
        :load-group-data="loadGroupData"
        :call-add-empty-row="pAddEmptyRow"
        :expand-form="expandForm"
        :load-group-page="loadGroupPage"
        :group-wrapper-change-page="groupWrapperChangePage"
        :row-height="rowHeight"
        :load-group-aggregation="loadGroupAggregation"
        :max-depth="groupBy.length"
        :redistribute-rows="redistributeRows"
        :view-width="viewWidth"
      />

      <Suspense>
        <LazySmartsheetExpandedForm
          v-if="expandedFormRow && expandedFormDlg"
          v-model="expandedFormDlg"
          :load-row="!isPublic"
          :row="expandedFormRow"
          :state="expandedFormRowState"
          :meta="meta"
          :view="view"
          @update:model-value="addRowExpandOnClose(expandedFormRow)"
        />
      </Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormOnRowIdDlg && meta?.id"
        ref="expandedFormRef"
        v-model="expandedFormOnRowIdDlg"
        :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
        :meta="meta"
        :load-row="!isPublic"
        :state="expandedFormRowState"
        :row-id="routeQuery.rowId"
        :view="view"
        show-next-prev-icons
        :first-row="isInfiniteScrollingEnabled ? isFirstRow : pisFirstRow"
        :last-row="isInfiniteScrollingEnabled ? isLastRow : pisLastRow"
        :expand-form="expandForm"
        @next="isInfiniteScrollingEnabled ? goToNextRow() : pGoToNextRow()"
        @prev="isInfiniteScrollingEnabled ? goToPreviousRow() : pGoToPreviousRow()"
        @update-row-comment-count="updateRowCommentCount"
      />
      <Suspense>
        <LazyDlgBulkUpdate
          v-if="bulkUpdateDlg"
          v-model="bulkUpdateDlg"
          :meta="meta"
          :view="view"
          :path="groupPath"
          :bulk-update-rows="bulkUpdateRows"
          :rows="selectedRows"
        />
      </Suspense>
    </div>

    <SmartsheetGridSmartTextPanel />

    <!-- Right-side expanded form panel -->
    <SmartsheetGridExpandedFormPanel v-if="isExpandedFormPanelOpen" />
  </div>
</template>

<style lang="scss">
.nc-grid-pagination-wrapper .ant-dropdown-button {
  > .ant-btn {
    @apply !p-0 !rounded-l-lg hover:border-nc-gray-300;
  }

  > .ant-dropdown-trigger {
    @apply !rounded-r-lg;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  @apply !rounded-lg;
}
</style>
