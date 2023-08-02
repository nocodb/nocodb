<script lang="ts" setup>
import type { ColumnType, GridType } from 'nocodb-sdk'
import Table from './Table.vue'
import GroupBy from './GroupBy.vue'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  MetaInj,
  NavigateDir,
  RowHeightInj,
  computed,
  extractPkFromRow,
  inject,
  message,
  provide,
  ref,
  useSmartsheetStoreOrThrow,
  useViewData,
  useViewGroupBy,
} from '#imports'
import type { Row } from '~/lib'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj, ref([]))

const router = useRouter()

const route = $(router.currentRoute)

const { xWhere, eventBus } = useSmartsheetStoreOrThrow()

const bulkUpdateDlg = ref(false)

const routeQuery = $computed(() => route.query as Record<string, string>)

const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()

const tableRef = ref<typeof Table>()

const {
  isLoading,
  loadData,
  paginationData,
  formattedData: data,
  updateOrSaveRow,
  changePage,
  addEmptyRow: _addEmptyRow,
  deleteRow,
  deleteSelectedRows,
  selectedAllRecords,
  removeRowIfNew,
  navigateToSiblingRow,
  getExpandedRowIndex,
  deleteRangeOfRows,
  bulkUpdateRows,
  bulkUpdateView,
  optimisedQuery,
} = useViewData(meta, view, xWhere)

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

provide(RowHeightInj, rowHeight)

// reload table data reload hook as fallback to rowdatareload
provide(ReloadRowDataHookInj, reloadViewDataHook)

const skipRowRemovalOnCancel = ref(false)

function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false) {
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])

  if (rowId) {
    router.push({
      query: {
        ...routeQuery,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true
    skipRowRemovalOnCancel.value = !fromToolbar
  }
}

defineExpose({
  loadData,
  openColumnCreate: tableRef.value?.openColumnCreate,
})

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!routeQuery.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...routeQuery,
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

function openGenerateDialog(target: any) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('SmartsheetDlgGenerate'), {
    'modelValue': isOpen,
    'target': target,
    'meta': meta,
    'view': view,
    'fields': fields,
    'data': data,
    'xWhere': xWhere,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const toggleOptimisedQuery = () => {
  if (optimisedQuery.value) {
    optimisedQuery.value = false
    message.info('Optimised query disabled')
  } else {
    optimisedQuery.value = true
    message.info('Optimised query enabled')
  }
}

const { rootGroup, groupBy, isGroupBy, loadGroups, loadGroupData, loadGroupPage, groupWrapperChangePage, redistributeRows } =
  useViewGroupBy(view, xWhere)

const coreWrapperRef = ref<HTMLElement>()

const viewWidth = ref(0)

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.GROUP_BY_RELOAD) {
    reloadViewDataHook?.trigger()
  }
})

onMounted(() => {
  until(coreWrapperRef)
    .toBeTruthy()
    .then(() => {
      const resizeObserver = new ResizeObserver(() => {
        viewWidth.value = coreWrapperRef.value?.clientWidth || 0
      })
      if (coreWrapperRef.value) resizeObserver.observe(coreWrapperRef.value)
    })
})
</script>

<template>
  <div
    ref="coreWrapperRef"
    class="relative flex flex-col h-full min-h-0 w-full"
    data-testid="nc-grid-wrapper"
    style="background-color: var(--nc-grid-bg)"
  >
    <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15" data-testid="grid-load-spinner">
      <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
        <a-spin size="large" />
      </div>
    </general-overlay>

    <Table
      v-if="!isGroupBy"
      ref="tableRef"
      v-model:selected-all-records="selectedAllRecords"
      :data="data"
      :pagination-data="paginationData"
      :load-data="loadData"
      :change-page="changePage"
      :call-add-empty-row="_addEmptyRow"
      :delete-row="deleteRow"
      :update-or-save-row="updateOrSaveRow"
      :delete-selected-rows="deleteSelectedRows"
      :delete-range-of-rows="deleteRangeOfRows"
      :bulk-update-rows="bulkUpdateRows"
      :remove-row-if-new="removeRowIfNew"
      :expand-form="expandForm"
      :row-height="rowHeight"
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
      :max-depth="groupBy.length"
      :redistribute-rows="redistributeRows"
      :expand-form="expandForm"
      :view-width="viewWidth"
    />

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="expandedFormRow"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
        @update:model-value="addRowExpandOnClose(expandedFormRow)"
      />
    </Suspense>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormOnRowIdDlg"
        :key="routeQuery.rowId"
        v-model="expandedFormOnRowIdDlg"
        :row="{ row: {}, oldRow: {}, rowMeta: {} }"
        :meta="meta"
        :row-id="routeQuery.rowId"
        :view="view"
        show-next-prev-icons
        :first-row="getExpandedRowIndex() === 0"
        :last-row="getExpandedRowIndex() === data.length - 1"
        @next="navigateToSiblingRow(NavigateDir.NEXT)"
        @prev="navigateToSiblingRow(NavigateDir.PREV)"
      />
    </Suspense>

    <Suspense>
      <LazyDlgBulkUpdate
        v-if="bulkUpdateDlg"
        v-model="bulkUpdateDlg"
        :pagination-data="paginationData"
        :meta="meta"
        :view="view"
        :bulk-update-rows="bulkUpdateRows"
        :bulk-update-view="bulkUpdateView"
        :selected-all-records="selectedAllRecords"
        :rows="data.filter((r) => r.rowMeta.selected)"
      />
    </Suspense>
  </div>
</template>

<style lang="scss">
.nc-pagination-wrapper .ant-dropdown-button {
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
