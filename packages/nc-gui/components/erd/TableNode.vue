<script lang="ts" setup>
import type { NodeProps } from '@braks/vue-flow'
import { Handle, Position } from '@braks/vue-flow'
import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiTableLarge from '~icons/mdi/table-large'

interface Props extends NodeProps {
  data: TableType & { showPkAndFk: boolean; showAllColumns: boolean }
}

const props = defineProps<Props>()

const { data } = toRefs(props)

provide(MetaInj, data as Ref<TableType>)

const columns = computed(() => {
  // Hide hm ltar created for `mm` relations
  return data.value.columns?.filter((col) => !(col.uidt === UITypes.LinkToAnotherRecord && col.system === 1))
})

const pkAndFkColumns = computed(() => {
  return columns.value
    ?.filter(() => data.value.showPkAndFk && data.value.showAllColumns)
    .filter((col) => col.pk || col.uidt === UITypes.ForeignKey)
})

const nonPkColumns = computed(() => {
  return columns.value
    ?.filter(
      (col: ColumnType) => data.value.showAllColumns || (!data.value.showAllColumns && col.uidt === UITypes.LinkToAnotherRecord),
    )
    .filter((col: ColumnType) => !col.pk && col.uidt !== UITypes.ForeignKey)
})

const relatedColumnId = (col: Record<string, any>) =>
  col.colOptions.type === 'mm' ? col.colOptions.fk_parent_column_id : col.colOptions.fk_child_column_id
</script>

<template>
  <div class="h-full flex flex-col min-w-16 bg-gray-50 rounded-lg border-1">
    <div
      class="text-gray-600 text-md py-2 border-b-1 border-gray-200 w-full pr-3 pl-2 bg-gray-100 font-semibold flex flex-row items-center"
    >
      <MdiTableLarge v-if="data.type === 'table'" class="text-primary" />
      <MdiView v-else class="text-primary" />
      <div class="flex pl-1.5">
        {{ data.title }}
      </div>
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
            <Handle
              :id="`s-${relatedColumnId(col)}-${data.id}`"
              class="-right-4 opacity-0"
              type="source"
              :position="Position.Right"
            />
            <Handle
              :id="`d-${relatedColumnId(col)}-${data.id}`"
              class="-left-1 opacity-0"
              type="target"
              :position="Position.Left"
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

<style scoped lang="scss">
.keys {
  background-color: #f6f6f6;
}
</style>
