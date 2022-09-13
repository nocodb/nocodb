<script setup>
import { Handle, Position } from '@braks/vue-flow'
import { UITypes, isVirtualCol } from 'nocodb-sdk'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const { data: table } = props
const columns = table.columns
// console.log(table)

const pkColumn = computed(() => {
  return columns.find((col) => col.pk)
})

const nonPkColumns = computed(() => {
  return columns.filter((col) => !col.pk && col.uidt !== UITypes.ForeignKey)
})
</script>

<template>
  <div class="h-full flex flex-col min-w-16 bg-gray-50 rounded-lg border-1">
    <div class="text-gray-600 text-md py-2 border-b-2 border-gray-100 w-full pl-3 bg-gray-100 font-semibold">
      {{ table.title }}
    </div>
    <div class="mx-1">
      <div class="w-full border-b-1 py-2 border-gray-100">
        <SmartsheetHeaderCell v-if="pkColumn" :column="pkColumn" :hide-menu="true" />
      </div>
      <div v-for="col in nonPkColumns" :key="col.title">
        <div class="w-full h-full flex items-center min-w-32 border-b-1 border-gray-100 py-2">
          <div v-if="col.uidt === UITypes.LinkToAnotherRecord" class="flex relative w-full">
            <Handle :id="`s-${col.id}-${table.id}`" class="-right-4" type="source" :position="Position.Right" :hidden="false" />
            <Handle
              :id="`d-${col.id}-${table.id}`"
              class="-left-1"
              type="destination"
              :position="Position.Left"
              :hidden="false"
            />
            <SmartsheetHeaderVirtualCell :column="col" :hide-menu="true" />
          </div>
          <SmartsheetHeaderVirtualCell v-else-if="isVirtualCol(col)" :column="col" :hide-menu="true" />

          <SmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
        </div>
      </div>
    </div>
  </div>
</template>
