<script lang="ts" setup>
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { LinkToAnotherRecordType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
import type { AiNodeData } from './utils'

interface Props extends Pick<NodeProps<AiNodeData>, 'data' | 'dragging'> {
  data: AiNodeData
  showSkeleton: boolean
  dragging: boolean
}

const { data, showSkeleton, dragging } = defineProps<Props>()

const { viewport } = useVueFlow()

const isZooming = refAutoReset(false, 200)

const { $e } = useNuxtApp()

const relatedColumnId = (colOptions: LinkToAnotherRecordType | any) =>
  colOptions.type === 'mm' ? colOptions.fk_parent_column_id : colOptions.fk_child_column_id

const hasColumns = computed(() => data.columns.length)

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
      <div class="capitalize">{{ data.table }}</div>
    </template>

    <div
      class="relative h-full max-w-76 flex flex-col justify-center bg-white min-w-16 min-h-8 rounded-lg nc-erd-table-node"
      :class="[`nc-erd-table-node-${data.table}`, showSkeleton ? 'cursor-pointer items-center min-h-200px min-w-300px' : '']"
      @click="$e('c:erd:node-click')"
    >
      <div
        :class="[showSkeleton ? '' : '', hasColumns ? '' : '']"
        class="text-gray-800 text-sm py-4 border-b-1 border-gray-200 rounded-t-lg w-full h-full px-3 font-medium flex items-center"
      >
        <GeneralTableIcon class="text-primary" :class="{ '!text-6xl !w-auto mr-2 !h-18': showSkeleton }" :meta="{ meta: {} }" />
        <div :class="showSkeleton ? 'text-6xl' : ''" class="flex pr-2 pl-1">
          {{ data.table }}
        </div>
      </div>

      <div v-if="showSkeleton">
        <Handle style="left: -20px" class="opacity-0" :position="Position.Left" type="target" :connectable="false" />
        <Handle style="right: -15px" class="opacity-0" :position="Position.Right" type="source" :connectable="false" />
      </div>

      <div v-else-if="data.columns.length" class="py-1 pr-0.5">
        <div v-for="(col, index) in data.columns" :key="col.title">
          <div
            class="relative w-full h-full flex items-center min-w-32 py-2 px-1"
            :class="index + 1 === data.columns.length ? 'rounded-b-lg' : ''"
          >
            <div
              v-if="col.relationType"
              class="flex w-full"
              :class="`nc-erd-table-node-${data.table}-column-${col.title?.toLowerCase().replace(' ', '_')}`"
            >
              <Handle
                :id="`s-${relatedColumnId(col.colOptions)}-${data.table}`"
                class="opacity-0 !right-[-1px]"
                type="source"
                :position="Position.Right"
                :connectable="false"
              />

              <Handle
                :id="`d-${relatedColumnId(col.colOptions)}-${data.table}`"
                class="opacity-0 !left-[-1px]"
                type="target"
                :position="Position.Left"
                :connectable="false"
              />

              <div class="nc-erd-table-node-column flex items-center gap-2">
                <SmartsheetHeaderVirtualCellIcon
                  :column-meta="{
                    uidt: 'Links',
                    colOptions: {
                      type: col.relationType,
                    },
                  }"
                />
                <NcTooltip show-on-truncate-only class="truncate text-sm">
                  <template #title>
                    {{ col.title }}
                  </template>
                  {{ col.title }}
                </NcTooltip>
              </div>
            </div>

            <div
              v-else-if="isVirtualCol(col.type)"
              class="nc-erd-table-node-column flex items-center gap-2"
              :class="`nc-erd-table-node-${data.table}-column-${col.title}`"
            >
              <SmartsheetHeaderVirtualCellIcon
                :column-meta="{
                  uidt: col.type,
                }"
              />
              <NcTooltip show-on-truncate-only class="truncate text-sm">
                <template #title>
                  {{ col.title }}
                </template>
                {{ col.title }}
              </NcTooltip>
            </div>

            <div
              v-else
              class="nc-erd-table-node-column flex items-center gap-2"
              :class="`nc-erd-table-node-${data.table}-column-${col.title}`"
            >
              <SmartsheetHeaderCellIcon
                :column-meta="{
                  uidt: col.type,
                }"
              />
              <NcTooltip show-on-truncate-only class="truncate text-sm">
                <template #title>
                  {{ col.title }}
                </template>
                {{ col.title }}
              </NcTooltip>
            </div>
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
