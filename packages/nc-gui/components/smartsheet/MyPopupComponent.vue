<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  MetaInj,
  NavigateDir,
  OpenNewRecordFormHookInj,
  PaginationDataInj,
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  computed,
  createEventHook,
  extractPkFromRow,
  inject,
  isImage,
  isLTAR,
  nextTick,
  onMounted,
  provide,
  ref,
  useAttachment,
  useViewData,
} from '#imports'
// import type { Row } from '~/lib'
// const props =
const props = defineProps<{
  fields: ColumnType[]
  row: Row
}>()

// defineProps({
// //   popupIsOpen: {
// //     type: Boolean,
// //     required: true,
// //   },
//   popUpRow: {
//     type: Object,
//     required: true,
//   },
//   fields: {
//     type: Array,
//     required: true,
//   },
// //   abstractType: {
// //     type: String,
// //     required: true,
// //   },
// })

const currentRow = toRef(props, 'row')

const { meta } = useSmartsheetStoreOrThrow()

// const rowStore = useProvideSmartsheetRowStore(meta as Ref<TableType>, currentRow)
const { row } = useProvideSmartsheetRowStore(meta as Ref<TableType>, currentRow)

console.log('rowStore', row.value.row)
// const { currentRow: row } = useSmartsheetRowStoreOrThrow()

// const cellValueByColum = (column: ColumnType) => {
//   return {
//     get() {
//       return props.row?.row[column.id!]
//     },
//     set() {},
//   }
// }

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}
</script>

<template>
  <!-- <div v-if="popupIsOpen" ref="popupContainer"> -->
  <div ref="popupContainer">
    <!-- FOO: {{ JSON.stringify(rowStore.row._object.fields) }} -->
    <!-- currenetRow: {{ JSON.stringify(currentRow) }} <br />
    meta: {{ JSON.stringify(meta) }} <br /> -->
    <!-- rowStore: {{ JSON.stringify(rowStore.row) }} -->
    <!-- FOO
      {{ JSON.stringify(row) }} -->
    <div v-for="col in fields" :key="col.id">
      <div
        v-if="!isRowEmpty(row, col) || isLTAR(col.uidt)"
        class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full"
      >
        <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
          <div class="w-full text-gray-600">
            <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />

            <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
          </div>
        </div>

        <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
          <LazySmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :column="col" :row="row" />

          <LazySmartsheetCell v-else v-model="row.row[col.title]" :column="col" :edit-enabled="false" :read-only="true" />
        </div>
      </div>
      <!-- <LazySmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :column="col" :row="row" />
      <LazySmartsheetCell v-else v-model="row.row[col.title]" :column="col" :edit-enabled="false" :read-only="true" /> -->

      <!-- {{ JSON.stringify(column) }} -->
      <!-- <LazySmartsheetCell v-else v-model="row.row[column.title]" :column="column" :edit-enabled="false" :read-only="true" /> -->

      <!-- <LazySmartsheetVirtualCell
        v-if="isVirtualCol(column)"
        v-model="rowStore.row[column.title]"
        :column="column"
        :row="props.row"
      />
      <LazySmartsheetCell
        v-if="!isVirtualCol(column)"
        v-model="rowStore.row[column.title]"
        :column="column"
        :edit-enabled="false"
        :read-only="true"
      /> -->

      <!-- <LazyCellTextArea v-if="isTextArea(column)" v-model="cellValueByColum(column)" /> -->
    </div>
    <!-- <div>{{ popUpRow?.row.Title }}</div> -->
  </div>
</template>
