<script lang="ts" setup>
import { RelationTypes, UITypes } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { computed } from 'vue'
import { useLTARStoreOrThrow, useVModel } from '#imports'
import { useSmartsheetRowStoreOrThrow } from '~/composables/useSmartsheetRowStore'
import { ColumnInj } from '~/context'

const props = defineProps<{ modelValue: boolean }>()

const emit = defineEmits(['update:modelValue', 'addNewRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const column = inject(ColumnInj)

const {
  childrenExcludedList,
  loadChildrenExcludedList,
  childrenExcludedListPagination,
  relatedTablePrimaryValueProp,
  link,
  getRelatedTableRowId,
  relatedTableMeta,
  meta,
  row,
} = useLTARStoreOrThrow()

const { addLTARRef, isNew } = useSmartsheetRowStoreOrThrow()

const linkRow = async (row: Record<string, any>) => {
  if (isNew.value) {
    addLTARRef(row, column?.value as ColumnType)
  } else {
    await link(row)
  }
  vModel.value = false
}

watch(vModel, () => {
  if (vModel.value) {
    loadChildrenExcludedList()
  }
})

const expandedFormDlg = ref(false)

/** populate initial state for a new row which is parent/child of current record */
const newRowState = computed(() => {
  const colOpt = (column?.value as ColumnType)?.colOptions as LinkToAnotherRecordType
  const colInRelatedTable: ColumnType = relatedTableMeta.value?.columns?.find((col) => {
    if (col.uidt !== UITypes.LinkToAnotherRecord) return false
    if (col?.colOptions?.fk_related_model_id !== meta.value.id) return false

    if (colOpt.type === RelationTypes.MANY_TO_MANY && col?.colOptions?.type === RelationTypes.MANY_TO_MANY) {
      return (
        colOpt.fk_parent_column_id === col.colOptions.fk_child_column_id &&
        colOpt.fk_child_column_id === col.colOptions.fk_parent_column_id
      )
    } else {
      return (
        colOpt.fk_parent_column_id === col.colOptions.fk_parent_column_id &&
        colOpt.fk_child_column_id === col.colOptions.fk_child_column_id
      )
    }
    return false
  })
  const relatedTableColOpt = colInRelatedTable?.colOptions as LinkToAnotherRecordType
  if (!relatedTableColOpt) return {}

  if (relatedTableColOpt.type === RelationTypes.BELONGS_TO) {
    return {
      [colInRelatedTable.title as string]: row,
    }
  } else {
    return {
      [colInRelatedTable.title as string]: [row],
    }
  }
})
</script>

<template>
  <a-modal v-model:visible="vModel" :footer="null" title="Link Record">
    <div class="max-h-[max(calc(100vh_-_300px)_,500px)] flex flex-col">
      <div class="flex mb-4 align-center gap-2">
        <a-input
          v-model:value="childrenExcludedListPagination.query"
          placeholder="Filter query"
          class="max-w-[200px]"
          size="small"
        ></a-input>
        <div class="flex-1" />
        <MdiReload class="cursor-pointer text-gray-500" @click="loadChildrenExcludedList" />
        <a-button type="primary" size="small" @click="expandedFormDlg = true">Add new record</a-button>
      </div>
      <template v-if="childrenExcludedList?.pageInfo?.totalRows">
        <div class="flex-1 overflow-auto min-h-0">
          <a-card
            v-for="(row, i) in childrenExcludedList?.list ?? []"
            :key="i"
            class="ma-2 cursor-pointer hover:(!bg-gray-200/50 shadow-md) group"
            @click="linkRow(row)"
          >
            {{ row[relatedTablePrimaryValueProp]
            }}<span class="hidden group-hover:(inline) text-gray-400 text-[11px] ml-1"
              >(Primary key : {{ getRelatedTableRowId(row) }})</span
            >
          </a-card>
        </div>
        <a-pagination
          v-if="childrenExcludedList?.pageInfo"
          v-model:current="childrenExcludedListPagination.page"
          v-model:page-size="childrenExcludedListPagination.size"
          class="mt-2 mx-auto !text-xs"
          size="small"
          :total="childrenExcludedList.pageInfo.totalRows"
          show-less-items
        />
      </template>
      <a-empty v-else class="my-10" />

      <SmartsheetExpandedForm
        v-if="expandedFormDlg"
        v-model="expandedFormDlg"
        :meta="relatedTableMeta"
        :row="{ row: {}, oldRow: {}, rowMeta: { new: true } }"
        :state="newRowState"
        load-row
        use-meta-fields
      />
    </div>
  </a-modal>
</template>

<style scoped>
:deep(.ant-pagination-item a) {
  line-height: 21px !important;
}
</style>
