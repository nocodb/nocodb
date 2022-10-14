<script lang="ts" setup>
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position } from '@vue-flow/core'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { MetaInj, computed, provide, toRefs, useNuxtApp } from '#imports'

interface Props extends NodeProps {
  data: TableType & { showPkAndFk: boolean; showAllColumns: boolean; color: string }
  showSkeleton: boolean
}

const props = defineProps<Props>()

const { data } = toRefs(props)

provide(MetaInj, data as Ref<TableType>)

const { $e } = useNuxtApp()

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

const relatedColumnId = (colOptions: LinkToAnotherRecordType | any) =>
  colOptions.type === 'mm' ? colOptions.fk_parent_column_id : colOptions.fk_child_column_id
</script>

<template>
  <div
    class="relative h-full flex flex-col justify-center items-center bg-slate-50 min-w-16 rounded-lg nc-erd-table-node"
    :class="[
      `nc-erd-table-node-${data.table_name}`,
      showSkeleton ? 'cursor-pointer bg-slate-200 min-h-200px min-w-300px px-4' : '',
    ]"
    @click="$e('c:erd:node-click')"
  >
    <GeneralTooltip class="h-full flex flex-1 justify-center items-center" modifier-key="Alt">
      <template #title> {{ data.table_name }} </template>

      <div
        :class="[showSkeleton ? '' : 'bg-primary bg-opacity-10 border-b-1']"
        class="text-slate-600 text-md py-2 border-slate-500 rounded-t-lg w-full h-full px-3 font-semibold flex items-center"
      >
        <MdiTableLarge v-if="data.type === 'table'" class="text-primary" :class="showSkeleton ? 'text-6xl !px-2' : ''" />
        <MdiEyeCircleOutline v-else class="text-primary" :class="showSkeleton ? 'text-6xl !px-2' : ''" />

        <div :class="showSkeleton ? 'text-6xl' : ''" class="flex px-2">
          {{ data.title }}
        </div>
      </div>
    </GeneralTooltip>

    <div v-if="showSkeleton">
      <Handle style="left: -20px" class="opacity-0" :position="Position.Left" type="target" :connectable="false" />
      <Handle style="right: -15px" class="opacity-0" :position="Position.Right" type="source" :connectable="false" />
    </div>

    <div v-else-if="nonPkColumns.length || pkAndFkColumns.length">
      <div
        v-for="col in pkAndFkColumns"
        :key="col.title"
        class="w-full border-b-1 py-2 border-slate-200 bg-slate-100"
        :class="`nc-erd-table-node-${data.table_name}-column-${col.column_name}`"
      >
        <LazySmartsheetHeaderCell v-if="col" :column="col" :hide-menu="true" />
      </div>

      <div v-if="nonPkColumns.length" class="w-full mb-1"></div>

      <div v-for="(col, index) in nonPkColumns" :key="col.title">
        <div
          class="relative w-full h-full flex items-center min-w-32 border-slate-200 py-2 px-1"
          :class="index + 1 === nonPkColumns.length ? 'rounded-b-lg' : 'border-b-1'"
        >
          <div
            v-if="col.uidt === UITypes.LinkToAnotherRecord"
            class="flex w-full"
            :class="`nc-erd-table-node-${data.table_name}-column-${col.title?.toLowerCase().replace(' ', '_')}`"
          >
            <Handle
              :id="`s-${relatedColumnId(col.colOptions)}-${data.id}`"
              class="opacity-0 !right-[-1px]"
              type="source"
              :position="Position.Right"
              :connectable="false"
            />

            <Handle
              :id="`d-${relatedColumnId(col.colOptions)}-${data.id}`"
              class="opacity-0 !left-[-1px]"
              type="target"
              :position="Position.Left"
              :connectable="false"
            />

            <LazySmartsheetHeaderVirtualCell :column="col" :hide-menu="true" />
          </div>

          <LazySmartsheetHeaderVirtualCell
            v-else-if="isVirtualCol(col)"
            :column="col"
            :hide-menu="true"
            :class="`nc-erd-table-node-${data.table_name}-column-${col.column_name}`"
          />

          <LazySmartsheetHeaderCell
            v-else
            :column="col"
            :hide-menu="true"
            :class="`nc-erd-table-node-${data.table_name}-column-${col.column_name}`"
          />
        </div>
      </div>
    </div>
  </div>
</template>
