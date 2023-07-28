<script lang="ts" setup>
import Table from './Table.vue'
import { computed, ref } from '#imports'
import type { Group, Row } from '~/lib'

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
}>()

const emits = defineEmits(['update:paginationData'])

const vGroup = useVModel(props, 'group', emits)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

function addEmptyRow(group: Group, addAfter?: number) {
  if (group.nested || !group.rows) return

  addAfter = addAfter ?? group.rows.length

  const setGroup = group.nestedIn.reduce((acc, curr) => {
    if (curr.value !== '__nc_null__') acc[curr.title] = curr.value
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

const { deleteRow, deleteSelectedRows, deleteRangeOfRows, updateOrSaveRow, bulkUpdateRows, selectedAllRecords } = useData({
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
</script>

<template>
  <Table
    v-if="vGroup.rows"
    :data="vGroup.rows"
    :pagination-data="vGroup.paginationData"
    :load-data="() => props.loadGroupData(vGroup, true)"
    :change-page="(p: number) => props.loadGroupPage(vGroup, p)"
    :call-add-empty-row="(addAfter?: number) => addEmptyRow(vGroup, addAfter)"
    :expand-form="props.expandForm"
    :row-height="rowHeight"
    :selected-all-records="selectedAllRecords"
    :hide-pagination-sidebars="true"
    :delete-row="deleteRow"
    :delete-selected-rows="deleteSelectedRows"
    :delete-range-of-rows="deleteRangeOfRows"
    :update-or-save-row="updateOrSaveRow"
    :bulk-update-rows="bulkUpdateRows"
    :hide-header="true"
  />
</template>

<style scoped lang="scss"></style>
