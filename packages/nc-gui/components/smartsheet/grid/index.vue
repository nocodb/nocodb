<script lang="ts" setup>
import type { ColumnType, GridType } from 'nocodb-sdk'
import InfiniteTable from './InfiniteTable.vue'
import Table from './Table.vue'
import GroupBy from './GroupBy.vue'
import CanvasTable from './canvas/index.vue'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const router = useRouter()

const route = router.currentRoute

const { xWhere, eventBus } = useSmartsheetStoreOrThrow()

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const bulkUpdateDlg = ref(false)

const routeQuery = computed(() => route.value.query as Record<string, string>)

const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()

const reloadVisibleDataHook = createEventHook()

provide(ReloadVisibleDataHookInj, reloadVisibleDataHook)

const tableRef = ref<typeof InfiniteTable>()

useProvideViewAggregate(view, meta, xWhere, reloadVisibleDataHook)

const {
  loadData,
  selectedRows,
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
  bulkDeleteAll,
} = useGridViewData(meta, view, xWhere, reloadVisibleDataHook)

const rowHeight = computed(() => {
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    switch ((view.value?.view as GridType)?.row_height) {
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

function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false) {
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
  expandedFormRowState.value = state
  if (rowId && !isPublic.value) {
    expandedFormRow.value = undefined

    router.push({
      query: {
        ...routeQuery.value,
        rowId,
      },
    })
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
    return !!routeQuery.value.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...routeQuery.value,
          rowId: undefined,
        },
      })
  },
})

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

const {
  rootGroup,
  groupBy,
  isGroupBy,
  loadGroups,
  loadGroupData,
  loadGroupPage,
  groupWrapperChangePage,
  redistributeRows,
  loadGroupAggregation,
} = useViewGroupByOrThrow()

const sidebarStore = useSidebarStore()

const { windowSize, leftSidebarWidth } = toRefs(sidebarStore)

const viewWidth = ref(0)

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.GROUP_BY_RELOAD || event === SmartsheetStoreEvents.DATA_RELOAD) {
    reloadViewDataHook?.trigger()
  }
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

const baseColor = computed(() => {
  switch (groupBy.value.length) {
    case 1:
      return '#F9F9FA'
    case 2:
      return '#F4F4F5'
    case 3:
      return '#E7E7E9'
    default:
      return '#F9F9FA'
  }
})

const isInfiniteScrollingEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.INFINITE_SCROLLING))

const isCanvasTableEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.CANVAS_GRID_VIEW))

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
  changePage: pChangeView,
} = useViewData(meta, view, xWhere)

const updateRowCommentCount = (count: number) => {
  if (!routeQuery.value.rowId) return

  if (isInfiniteScrollingEnabled.value) {
    const currentRowIndex = Array.from(cachedRows.value.values()).find(
      (row) => extractPkFromRow(row.row, meta.value!.columns!) === routeQuery.value.rowId,
    )?.rowMeta.rowIndex

    if (currentRowIndex === undefined) return

    const currentRow = cachedRows.value.get(currentRowIndex)
    if (!currentRow) return

    currentRow.rowMeta.commentCount = count

    syncVisibleData?.()
  } else {
    const aggCommentCountIndex = pAggCommentCount.value.findIndex((row) => row.row_id === routeQuery.value.rowId)
    const currentRowIndex = pData.value.findIndex(
      (row) => extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) === routeQuery.value.rowId,
    )

    if (aggCommentCountIndex === -1 || currentRowIndex === -1) return

    if (Number(pAggCommentCount.value[aggCommentCountIndex].count) === count) return
    pAggCommentCount.value[aggCommentCountIndex].count = count
    pData.value[currentRowIndex].rowMeta.commentCount = count
  }
}
const pGoToNextRow = () => {
  const currentIndex = pGetExpandedRowIndex()
  /* when last index of current page is reached we should move to next page */
  if (!pPaginationData.value.isLastPage && currentIndex === pPaginationData.value.pageSize) {
    const nextPage = pPaginationData.value?.page ? pPaginationData.value?.page + 1 : 1
    pChangeView(nextPage)
  }
  navigateToSiblingRow(NavigateDir.NEXT)
}
const pGoToPreviousRow = () => {
  const currentIndex = pGetExpandedRowIndex()
  /* when first index of current page is reached and then clicked back
    previos page should be loaded
  */
  if (!pPaginationData.value.isFirstPage && currentIndex === 1) {
    const nextPage = pPaginationData.value?.page ? pPaginationData.value?.page - 1 : 1
    pChangeView(nextPage)
  }
  navigateToSiblingRow(NavigateDir.PREV)
}
</script>

<template>
  <div
    class="relative flex flex-col h-full min-h-0 w-full nc-grid-wrapper"
    data-testid="nc-grid-wrapper"
    :style="`background-color: ${isGroupBy ? `${baseColor}` : 'var(--nc-grid-bg)'};`"
  >
    <Table
      v-if="!isGroupBy && !isInfiniteScrollingEnabled"
      ref="tableRef"
      v-model:selected-all-records="pSelectedAllRecords"
      :data="pData"
      :pagination-data="pPaginationData"
      :load-data="pLoadData"
      :change-page="pChangePage"
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
      v-else-if="!isGroupBy && isInfiniteScrollingEnabled && isCanvasTableEnabled"
      ref="tableRef"
      v-model:selected-all-records="selectedAllRecords"
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

    <InfiniteTable
      v-else-if="!isGroupBy"
      ref="tableRef"
      v-model:selected-all-records="selectedAllRecords"
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
      :load-group-page="loadGroupPage"
      :group-wrapper-change-page="groupWrapperChangePage"
      :row-height="rowHeight"
      :load-group-aggregation="loadGroupAggregation"
      :max-depth="groupBy.length"
      :redistribute-rows="redistributeRows"
      :view-width="viewWidth"
    />
    <Suspense v-if="!isGroupBy">
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
    <SmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id && !isGroupBy"
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
        :bulk-update-rows="bulkUpdateRows"
        :rows="selectedRows"
      />
    </Suspense>
  </div>
</template>

<style lang="scss">
.nc-grid-pagination-wrapper .ant-dropdown-button {
  > .ant-btn {
    @apply !p-0 !rounded-l-lg hover:border-gray-300;
  }

  > .ant-dropdown-trigger {
    @apply !rounded-r-lg;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  @apply !rounded-lg;
}
</style>
