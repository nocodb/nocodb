<script lang="ts" setup>
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { LinkToAnotherRecordType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { NodeData } from './utils'
import { MetaInj, computed, provide, refAutoReset, toRef, useNuxtApp, watch } from '#imports'

interface Props extends Pick<NodeProps<NodeData>, 'data' | 'dragging'> {
  data: NodeData
  showSkeleton: boolean
  dragging: boolean
}

const { data, showSkeleton, dragging } = defineProps<Props>()

const { viewport } = useVueFlow()

const table = toRef(data, 'table')

const isZooming = refAutoReset(false, 200)

provide(MetaInj, table)

const { $e } = useNuxtApp()

const relatedColumnId = (colOptions: LinkToAnotherRecordType | any) =>
  colOptions.type === 'mm' ? colOptions.fk_parent_column_id : colOptions.fk_child_column_id

const hasColumns = computed(() => data.pkAndFkColumns.length || data.nonPkColumns.length)

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
      class="relative h-full flex flex-col justify-center bg-slate-50 min-w-16 min-h-8 rounded-lg nc-erd-table-node"
      :class="[
        `nc-erd-table-node-${table.table_name}`,
        showSkeleton ? 'cursor-pointer items-center bg-slate-200 min-h-200px min-w-300px px-4' : '',
      ]"
      @click="$e('c:erd:node-click')"
    >
      <div
        :class="[showSkeleton ? '' : 'bg-primary bg-opacity-10', hasColumns ? 'border-b-1' : '']"
        class="text-slate-600 text-md py-2 border-slate-500 rounded-t-lg w-full h-full px-3 font-semibold flex items-center"
      >
        <GeneralTableIcon class="text-primary" :class="{ '!text-6xl !w-auto mr-2': showSkeleton }" :meta="table" />
        <div :class="showSkeleton ? 'text-6xl' : ''" class="flex pr-2 pl-1">
          {{ table.title }}
        </div>
      </div>

      <div v-if="showSkeleton">
        <Handle style="left: -20px" class="opacity-0" :position="Position.Left" type="target" :connectable="false" />
        <Handle style="right: -15px" class="opacity-0" :position="Position.Right" type="source" :connectable="false" />
      </div>

      <div v-else-if="hasColumns">
        <div
          v-for="col in data.pkAndFkColumns"
          :key="col.title"
          class="w-full h-full min-w-32 border-b-1 py-2 px-1 border-slate-200 bg-slate-100"
          :class="`nc-erd-table-node-${table.table_name}-column-${col.column_name}`"
        >
          <LazySmartsheetHeaderCell v-if="col" :column="col" :hide-menu="true" />
        </div>

        <div v-for="(col, index) in data.nonPkColumns" :key="col.title">
          <div
            class="relative w-full h-full flex items-center min-w-32 border-slate-200 py-2 px-1"
            :class="index + 1 === data.nonPkColumns.length ? 'rounded-b-lg' : 'border-b-1'"
          >
            <div
              v-if="col.uidt === UITypes.LinkToAnotherRecord"
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

              <LazySmartsheetHeaderVirtualCell :column="col" :hide-menu="true" />
            </div>

            <LazySmartsheetHeaderVirtualCell
              v-else-if="isVirtualCol(col)"
              :column="col"
              :hide-menu="true"
              :class="`nc-erd-table-node-${table.table_name}-column-${col.column_name}`"
            />

            <LazySmartsheetHeaderCell
              v-else
              :column="col"
              :hide-menu="true"
              :class="`nc-erd-table-node-${table.table_name}-column-${col.column_name}`"
            />
          </div>
        </div>
      </div>
    </div>
  </GeneralTooltip>
</template>
