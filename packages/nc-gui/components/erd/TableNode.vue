<script lang="ts" setup>
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { LinkToAnotherRecordType } from 'nocodb-sdk'
import { isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'
import type { NodeData } from './utils'

interface Props extends Pick<NodeProps<NodeData>, 'data' | 'dragging'> {
  data: NodeData
  showSkeleton: boolean
  dragging: boolean
}

const { data, showSkeleton, dragging } = defineProps<Props>()

const { viewport } = useVueFlow()

const table = computed(() => data.table)

const isZooming = refAutoReset(false, 200)

provide(MetaInj, table)

const { $e } = useNuxtApp()

const relatedColumnId = (colOptions: LinkToAnotherRecordType | any) =>
  colOptions.type === 'mm' ? colOptions.fk_parent_column_id : colOptions.fk_child_column_id

const hasColumns = computed(() => data.pkAndFkColumns.length || data.nonPkColumns.length)

const nonPkColumns = computed(() =>
  data.nonPkColumns
    // Removed MM system column from the table node
    .filter((col) => !(col.system && isLinksOrLTAR(col) && /.*_nc_m2m_.*/.test(col.title!))),
)

watch(
  () => viewport.value.zoom,
  () => {
    isZooming.value = true
  },
)
</script>

<template>
  <GeneralTooltip
    class="h-full flex flex-1 justify-center items-center"
    :modifier-key="showSkeleton || viewport.zoom > 0.35 ? 'Alt' : undefined"
    :disabled="dragging || isZooming"
  >
    <template #title>
      <div class="capitalize">{{ table.table_name }}</div>
    </template>

    <div
      class="relative h-full max-w-76 flex flex-col justify-center bg-white min-w-16 min-h-8 rounded-lg nc-erd-table-node"
      :class="[
        `nc-erd-table-node-${table.table_name}`,
        showSkeleton ? 'cursor-pointer items-center min-h-200px min-w-300px' : '',
      ]"
      @click="$e('c:erd:node-click')"
    >
      <div
        :class="[showSkeleton ? '' : '', hasColumns ? '' : '']"
        class="text-gray-800 text-sm py-4 border-b-1 border-gray-200 rounded-t-lg w-full h-full px-3 font-medium flex items-center"
      >
        <GeneralTableIcon class="text-primary" :class="{ '!text-6xl !w-auto mr-2 !h-18': showSkeleton }" :meta="table" />
        <div :class="showSkeleton ? 'text-6xl' : ''" class="flex pr-2 pl-1">
          {{ table.title }}
        </div>
      </div>

      <div v-if="showSkeleton">
        <Handle style="left: -20px" class="opacity-0" :position="Position.Left" type="target" :connectable="false" />
        <Handle style="right: -15px" class="opacity-0" :position="Position.Right" type="source" :connectable="false" />
      </div>

      <div v-else-if="hasColumns" class="py-1 pr-0.5">
        <div
          v-for="col in data.pkAndFkColumns"
          :key="col.title"
          class="w-full h-full min-w-32 py-2 px-1"
          :class="`nc-erd-table-node-${table.table_name}-column-${col.column_name}`"
        >
          <LazySmartsheetHeaderCell v-if="col" class="nc-erd-table-node-column" :column="col" :hide-menu="true" />
        </div>

        <div v-for="(col, index) in nonPkColumns" :key="col.title">
          <div
            class="relative w-full h-full flex items-center min-w-32 py-2 px-1"
            :class="index + 1 === nonPkColumns.length ? 'rounded-b-lg' : ''"
          >
            <div
              v-if="isLinksOrLTAR(col)"
              class="flex w-full"
              :class="`nc-erd-table-node-${table.table_name}-column-${col.title?.toLowerCase().replace(' ', '_')}`"
            >
              <Handle
                :id="`s-${relatedColumnId(col.colOptions)}-${table.id}`"
                class="opacity-0 !right-[-1px]"
                type="source"
                :position="Position.Right"
                :connectable="false"
              />

              <Handle
                :id="`d-${relatedColumnId(col.colOptions)}-${table.id}`"
                class="opacity-0 !left-[-1px]"
                type="target"
                :position="Position.Left"
                :connectable="false"
              />

              <LazySmartsheetHeaderVirtualCell class="nc-erd-table-node-column" :column="col" :hide-menu="true" />
            </div>

            <LazySmartsheetHeaderVirtualCell
              v-else-if="isVirtualCol(col)"
              :column="col"
              :hide-menu="true"
              :class="`nc-erd-table-node-column nc-erd-table-node-${table.table_name}-column-${col.column_name}`"
            />

            <LazySmartsheetHeaderCell
              v-else
              :column="col"
              :hide-menu="true"
              :class="`nc-erd-table-node-column nc-erd-table-node-${table.table_name}-column-${col.column_name}`"
            />
          </div>
        </div>
      </div>
    </div>
  </GeneralTooltip>
</template>

<style lang="scss" scoped>
.nc-erd-table-node-column {
  @apply py-0.5 px-2 text-gray-700;
}
</style>
