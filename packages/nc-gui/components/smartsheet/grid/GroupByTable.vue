<script lang="ts" setup>
import Table from './Table.vue'
import { IsGroupByInj, computed, ref } from '#imports'
import type { Group, Row } from '#imports'

const props = defineProps<{
  group: Group

  loadGroups: (params?: any, group?: Group) => Promise<void>
  loadGroupData: (group: Group, force?: boolean) => Promise<void>
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

function addEmptyRow(group: Group, addAfter?: number) {
  if (group.nested || !group.rows) return

  addAfter = addAfter ?? group.rows.length

  const setGroup = group.nestedIn.reduce((acc, curr) => {
    if (curr.key !== '__nc_null__') acc[curr.title] = curr.key
    return acc
  }, {} as Record<string, any>)

  group.rows.splice(addAfter, 0, {
    row: {
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

const { deleteRow, deleteSelectedRows, deleteRangeOfRows, updateOrSaveRow, bulkUpdateRows, selectedAllRecords, removeRowIfNew } =
  useData({
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

const reloadTableData = async () => {
  await props.loadGroupData(vGroup.value, true)
}

onBeforeUnmount(async () => {
  // reset hooks
  reloadViewDataHook?.off(reloadTableData)
})

reloadViewDataHook?.on(reloadTableData)

provide(IsGroupByInj, ref(true))

const scrollBump = computed<number>(() => {
  if (props.scrollLeft && props.viewWidth && props.scrollable) {
    const scrollWidth = props.scrollable.scrollWidth
    if (props.scrollLeft + props.viewWidth > scrollWidth) {
      return scrollWidth - props.viewWidth
    }
    return Math.max(Math.min(scrollWidth - props.viewWidth, (props.scrollLeft ?? 0) - 24), 0)
  }
  return 0
})

const pagination = computed(() => {
  return {
    fixedSize: props.paginationFixedSize ? props.paginationFixedSize - 2 : undefined,
    hideSidebars: props.paginationHideSidebars,
    extraStyle: `margin-left: ${scrollBump.value}px;`,
  }
})
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
    :delete-selected-rows="deleteSelectedRows"
    :delete-range-of-rows="deleteRangeOfRows"
    :update-or-save-row="updateOrSaveRow"
    :remove-row-if-new="removeRowIfNew"
    :bulk-update-rows="bulkUpdateRows"
    :hide-header="true"
    :pagination="pagination"
    :disable-skeleton="true"
  />
</template>

<style scoped lang="scss"></style>
