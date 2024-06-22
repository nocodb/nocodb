<script lang="ts" setup>
import { UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import Table from './Table.vue'

const props = defineProps<{
  group: Group

  loadGroups: (params?: any, group?: Group) => Promise<void>
  loadGroupData: (group: Group, force?: boolean, params?: any) => Promise<void>
  loadGroupPage: (group: Group, p: number) => Promise<void>
  groupWrapperChangePage: (page: number, groupWrapper?: Group) => Promise<void>

  redistributeRows?: (group?: Group) => void

  depth?: number
  maxDepth?: number

  rowHeight?: number
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void

  paginationFixedSize?: number
  paginationHideSidebars?: boolean

  scrollLeft?: number
  viewWidth?: number
  scrollable?: HTMLElement | null
}>()

const emits = defineEmits(['update:paginationData'])

const vGroup = useVModel(props, 'group', emits)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

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

onBeforeUnmount(async () => {
  // reset hooks
  reloadViewDataHook?.off(reloadTableData)
})

reloadViewDataHook?.on(reloadTableData)

provide(IsGroupByInj, ref(true))

const pagination = computed(() => {
  return {
    fixedSize: props.paginationFixedSize ? props.paginationFixedSize - 2 : undefined,
    hideSidebars: props.paginationHideSidebars,
    extraStyle: 'background: transparent !important; border-top: 0px;',
  }
})

async function deleteSelectedRowsWrapper() {
  if (!deleteSelectedRows) return

  await deleteSelectedRows()
  // reload table data
  await reloadTableData({ shouldShowLoading: true })
}
</script>

<template>
  <Table
    v-if="vGroup.rows"
    v-model:selected-all-records="selectedAllRecords"
    class="nc-group-table"
    :data="vGroup.rows"
    :pagination-data="vGroup.paginationData"
    :load-data="async () => {}"
    :change-page="(p: number) => props.loadGroupPage(vGroup, p)"
    :call-add-empty-row="(addAfter?: number) => addEmptyRow(vGroup, addAfter)"
    :expand-form="props.expandForm"
    :row-height="rowHeight"
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
</template>

<style scoped lang="scss"></style>
