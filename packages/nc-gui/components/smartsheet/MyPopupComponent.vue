<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
import type { Row } from '~/lib'
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

const props = defineProps<{
  fields: ColumnType[]
  row: RowType
}>()

// const cellValueByColum = (column: ColumnType) => {
//   return {
//     get() {
//       return props.row?.row[column.id!]
//     },
//     set() {},
//   }
// }
</script>

<template>
  <div>Test</div>
  <!-- <div v-if="popupIsOpen" ref="popupContainer"> -->
  <div ref="popupContainer">
    FOO
    <div v-for="column in props.fields" :key="column.id">
      {{ JSON.stringify(column) }}
      {{ JSON.stringify(props.fields) }}
      <!-- <LazyCellTextArea v-if="isTextArea(column)" v-model="cellValueByColum(column)" /> -->
      <!-- <LazySmartsheetVirtualCell
        v-if="isVirtualCol(column)"
        v-model="props.row.row[col.title]"
        :column="column"
        :row="props.row"
      /> -->
    </div>
    <!-- <div>{{ popUpRow?.row.Title }}</div> -->
  </div>
</template>
