<script setup>
import { Handle, Position } from '@braks/vue-flow'
import { UITypes, isVirtualCol } from 'nocodb-sdk'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const { data } = toRefs(props)

provide(MetaInj, data)

const columns = data.value.columns

const pkAndFkColumns = computed(() => {
  return columns.filter(() => data.value.showPkAndFk).filter((col) => col.pk || col.uidt === UITypes.ForeignKey)
})

const nonPkColumns = computed(() => {
  return columns.filter((col) => !col.pk && col.uidt !== UITypes.ForeignKey)
})
</script>

<template>
  <div class="h-full flex flex-col min-w-16 bg-gray-50 rounded-lg border-1">
    <div class="text-gray-600 text-md py-2 border-b-2 border-gray-100 w-full pl-3 bg-gray-100 font-semibold">
      {{ data.title }}
    </div>
    <div>
      <div class="keys mb-1">
        <div v-for="col in pkAndFkColumns" :key="col.title" class="w-full border-b-1 py-2 border-gray-100">
          <SmartsheetHeaderCell v-if="col" :column="col" :hide-menu="true" />
        </div>
      </div>
      <div v-for="col in nonPkColumns" :key="col.title">
        <div class="w-full h-full flex items-center min-w-32 border-b-1 border-gray-100 py-2 px-1">
          <div v-if="col.uidt === UITypes.LinkToAnotherRecord" class="flex relative w-full">
            <Handle :id="`s-${col.id}-${data.id}`" class="-right-4 opacity-0" type="source" :position="Position.Right" />
            <Handle :id="`d-${col.id}-${data.id}`" class="-left-1 opacity-0" type="target" :position="Position.Left" />
            <SmartsheetHeaderVirtualCell :column="col" :hide-menu="true" />
          </div>
          <SmartsheetHeaderVirtualCell v-else-if="isVirtualCol(col)" :column="col" :hide-menu="true" />

          <SmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.keys {
  background-color: #f6f6f6;
}
</style>
