<script lang="ts" setup>
import { type ColumnType, UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import Table from './Table.vue'
import { NavigateDir } from '~/lib/enums'

const props = defineProps<{
  group: Group

  loadGroups: (params?: any, group?: Group, options?: { triggerChildOnly: boolean }) => Promise<void>
  loadGroupData: (group: Group, force?: boolean, params?: any) => Promise<void>
  loadGroupPage: (group: Group, p: number) => Promise<void>
  groupWrapperChangePage: (page: number, groupWrapper?: Group) => Promise<void>

  redistributeRows?: (group?: Group) => void

  depth?: number
  maxDepth?: number

  rowHeight?: number

  paginationFixedSize?: number
  paginationHideSidebars?: boolean

  scrollLeft?: number
  viewWidth?: number
  scrollable?: HTMLElement | null
}>()

const emits = defineEmits(['update:paginationData'])

const vGroup = useVModel(props, 'group', emits)

const { t } = useI18n()

const router = useRouter()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const skipRowRemovalOnCancel = ref(false)

const { eventBus } = useSmartsheetStoreOrThrow()

const route = router.currentRoute

const routeQuery = computed(() => route.value.query as Record<string, string>)

const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()

const groupByKeyId = computed(() => routeQuery.value.group)

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!routeQuery.value.rowId
  },
  set(val) {
    if (!val) {
      router.push({
        query: {
          ...routeQuery.value,
          rowId: undefined,
          group: undefined,
        },
      })
      expandedFormRow.value = {}
      expandedFormRowState.value = {}
    }
  },
})

function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false, groupByKey?: string) {
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
  expandedFormRowState.value = state
  if (rowId && !isPublic.value) {
    router.push({
      query: {
        ...routeQuery.value,
        group: vGroup.value.key,
        rowId,
      },
    })
  } else {
    if (groupByKey && groupByKey !== vGroup.value.key) {
      return
    }
    expandedFormRow.value = row
    expandedFormDlg.value = true
    skipRowRemovalOnCancel.value = !fromToolbar
  }
}

const addRowExpandOnClose = (row: Row) => {
  eventBus.emit(SmartsheetStoreEvents.CLEAR_NEW_ROW, row)
}

function addEmptyRow(group: Group, addAfter?: number, metaValue = meta.value) {
  if (group.nested || !group.rows) return

  addAfter = addAfter ?? group.rows.length

  const setGroup = group.nestedIn.reduce((acc, curr) => {
    if (
      curr.key !== '__nc_null__' &&
      // avoid setting default value for rollup, formula, barcode, qrcode, links, ltar
      !isLinksOrLTAR(curr.column_uidt) &&
      ![UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.Barcode, UITypes.QrCode].includes(curr.column_uidt)
    ) {
      acc[curr.title] = curr.key

      if (curr.column_uidt === UITypes.Checkbox) {
        acc[curr.title] =
          acc[curr.title] === GROUP_BY_VARS.TRUE ? true : acc[curr.title] === GROUP_BY_VARS.FALSE ? false : !!acc[curr.title]
      }
    }
    return acc
  }, {} as Record<string, any>)
  group.count = group.count + 1

  group.rows.splice(addAfter, 0, {
    row: {
      ...rowDefaultData(metaValue?.columns),
      ...setGroup,
    },
    oldRow: {},
    rowMeta: { new: true },
  })

  return group.rows[addAfter]
}

const formattedData = computed(() => {
  if (!vGroup.value.nested && vGroup.value.rows) {
    return vGroup.value.rows
  }
  return [] as Row[]
})

const {
  deleteRow: _deleteRow,
  deleteSelectedRows,
  deleteRangeOfRows,
  updateOrSaveRow,
  bulkUpdateRows,
  selectedAllRecords,
  removeRowIfNew,
} = useData({
  meta,
  viewMeta: view,
  formattedData,
  paginationData: ref(vGroup.value.paginationData),
  callbacks: {
    changePage: (p: number) => props.loadGroupPage(vGroup.value, p),
    loadData: () => props.loadGroupData(vGroup.value, true),
    globalCallback: () => props.redistributeRows?.(),
  },
})

const deleteRow = async (rowIndex: number) => {
  vGroup.value.count = vGroup.value.count - 1
  await _deleteRow(rowIndex)
}

const reloadTableData = async (params: void | { shouldShowLoading?: boolean | undefined; offset?: number | undefined }) => {
  await props.loadGroupData(vGroup.value, true, {
    ...(params?.offset !== undefined ? { offset: params.offset } : {}),
  })
}

provide(IsGroupByInj, ref(true))

const pagination = computed(() => {
  return {
    fixedSize: props.paginationFixedSize ? props.paginationFixedSize - 2 : undefined,
    hideSidebars: props.paginationHideSidebars,
    extraStyle: 'background: transparent !important; border-top: 0px;',
  }
})

// get current expanded row index
function getExpandedRowIndex() {
  return formattedData.value.findIndex(
    (row: Row) => routeQuery.value.rowId === extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
  )
}

const navigateToSiblingRow = async (dir: NavigateDir) => {
  // debugger
  const expandedRowIndex = getExpandedRowIndex()

  // calculate next row index based on direction
  let siblingRowIndex = expandedRowIndex + (dir === NavigateDir.NEXT ? 1 : -1)

  // if unsaved row skip it
  while (formattedData.value[siblingRowIndex]?.rowMeta?.new) {
    siblingRowIndex = siblingRowIndex + (dir === NavigateDir.NEXT ? 1 : -1)
  }

  const currentPage = vGroup.value.paginationData?.page || 1

  // if next row index is less than 0, go to previous page and point to last element
  if (siblingRowIndex < 0) {
    // if first page, do nothing
    if (currentPage === 1) return message.info(t('msg.info.noMoreRecords'))

    await props.loadGroupPage(vGroup.value, currentPage - 1)
    siblingRowIndex = formattedData.value.length - 1

    // if next row index is greater than total rows in current view
    // then load next page of formattedData and set next row index to 0
  } else if (siblingRowIndex >= formattedData.value.length) {
    if (vGroup.value.paginationData?.isLastPage) return message.info(t('msg.info.noMoreRecords'))

    await props.loadGroupPage(vGroup.value, currentPage + 1)

    siblingRowIndex = 0
  }

  // extract the row id of the sibling row
  const rowId = extractPkFromRow(formattedData.value[siblingRowIndex].row, meta.value?.columns as ColumnType[])
  if (rowId) {
    await router.push({
      query: {
        ...routeQuery.value,
        rowId,
      },
    })
  }
}

const goToNextRow = async () => {
  const currentIndex = getExpandedRowIndex()
  /* when last index of current page is reached we should move to next page */
  if (!vGroup.value.paginationData?.isLastPage && currentIndex === vGroup.value.paginationData?.pageSize) {
    const nextPage = vGroup.value.paginationData?.page ? vGroup.value.paginationData?.page + 1 : 1
    await props.loadGroupPage(vGroup.value, nextPage)
  }

  navigateToSiblingRow(NavigateDir.NEXT)
}

const goToPreviousRow = async () => {
  const currentIndex = getExpandedRowIndex()
  /* when first index of current page is reached and then clicked back
    previos page should be loaded
  */
  if (!vGroup.value.paginationData?.isFirstPage && currentIndex === 1) {
    const nextPage = vGroup.value.paginationData?.page ? vGroup.value.paginationData?.page - 1 : 1
    await props.loadGroupPage(vGroup.value, nextPage)
  }

  navigateToSiblingRow(NavigateDir.PREV)
}

const isLastRow = computed(() => {
  const currentIndex = getExpandedRowIndex()
  return vGroup.value.paginationData?.isLastPage && currentIndex === formattedData.value.length - 1
})

const isFirstRow = computed(() => {
  const currentIndex = getExpandedRowIndex()
  return vGroup.value.paginationData?.isFirstPage && currentIndex === 0
})

async function deleteSelectedRowsWrapper() {
  if (!deleteSelectedRows) return

  await deleteSelectedRows()
  // reload table data
  await reloadTableData({ shouldShowLoading: false })
}

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

onBeforeUnmount(async () => {
  // reset hooks
  reloadViewDataHook?.off(reloadTableData)
})

reloadViewDataHook?.on(reloadTableData)

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.GROUP_BY_RELOAD || event === SmartsheetStoreEvents.DATA_RELOAD) {
    reloadViewDataHook?.trigger()
  }
})
</script>

<template>
  <!-- eslint-disable vue/no-restricted-v-bind -->
  <Table
    v-if="vGroup.rows"
    v-model:selected-all-records="selectedAllRecords"
    class="nc-group-table"
    :data="vGroup.rows"
    :v-group="vGroup"
    :pagination-data="vGroup.paginationData"
    :load-data="async () => {}"
    :change-page="(p: number) => props.loadGroupPage(vGroup, p)"
    :call-add-empty-row="(addAfter?: number) => addEmptyRow(vGroup, addAfter)"
    :expand-form="expandForm"
    :row-height-enum="rowHeight"
    :delete-row="deleteRow"
    :delete-selected-rows="deleteSelectedRowsWrapper"
    :delete-range-of-rows="deleteRangeOfRows"
    :update-or-save-row="updateOrSaveRow"
    :remove-row-if-new="removeRowIfNew"
    :bulk-update-rows="bulkUpdateRows"
    :hide-header="true"
    :pagination="pagination"
    :disable-skeleton="true"
    :disable-virtual-y="true"
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

  <!-- eslint-disable vue/eqeqeq -->
  <SmartsheetExpandedForm
    v-if="expandedFormOnRowIdDlg && meta?.id && groupByKeyId === vGroup.key"
    v-model="expandedFormOnRowIdDlg"
    :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
    :meta="meta"
    :load-row="!isPublic"
    :state="expandedFormRowState"
    :row-id="routeQuery.rowId"
    :view="view"
    show-next-prev-icons
    :first-row="isFirstRow"
    :last-row="isLastRow"
    :expand-form="expandForm"
    @next="goToNextRow"
    @prev="goToPreviousRow"
  />
</template>
