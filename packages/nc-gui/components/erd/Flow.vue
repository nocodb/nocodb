<script setup lang="ts">
import { Background, Controls } from '@vue-flow/additional-components'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { TableType } from 'nocodb-sdk'
import type { ErdFlowConfig } from './utils'
import { useErdElements } from './utils'
import { computed, onScopeDispose, toRefs, watch } from '#imports'

interface Props {
  tables: TableType[]
  config: ErdFlowConfig
}

const props = defineProps<Props>()

const { tables, config } = toRefs(props)

const { $destroy, fitView, onPaneReady, viewport } = useVueFlow({ minZoom: 0.1, maxZoom: 2 })

const { layout, elements } = useErdElements(tables, config)

const showSkeleton = computed(() => viewport.value.zoom < 0.25)

function init() {
  layout(showSkeleton.value)
  setTimeout(() => {
    fitView({ duration: 500 })
  }, 100)
}

onPaneReady(init)

watch(tables, init, { flush: 'post' })
watch(
  showSkeleton,
  layout,
  { flush: 'post' },
)

onScopeDispose($destroy)
</script>

<template>
  <VueFlow v-model="elements">
    <Controls position="top-right" :show-fit-view="false" :show-interactive="false" />

    <template #node-custom="{ data }">
      <ErdTableNode :data="data" :show-skeleton="showSkeleton" />
    </template>

    <template #edge-custom="edgeProps">
      <ErdRelationEdge v-bind="edgeProps" :show-skeleton="showSkeleton" />
    </template>

    <Background :size="showSkeleton ? 2 : undefined" :gap="showSkeleton ? 50 : undefined" />

    <div
      v-if="!config.singleTableMode"
      class="absolute bottom-0 right-0 flex flex-col text-xs bg-white px-2 py-1 border-1 rounded-md border-gray-200 z-50 nc-erd-histogram"
      style="font-size: 0.6rem"
    >
      <div class="flex flex-row items-center space-x-1 border-b-1 pb-1 border-gray-100">
        <MdiTableLarge class="text-primary" />
        <div>{{ $t('objects.table') }}</div>
      </div>

      <div class="flex flex-row items-center space-x-1 pt-1">
        <MdiEyeCircleOutline class="text-primary" />
        <div>{{ $t('objects.sqlVIew') }}</div>
      </div>
    </div>
  </VueFlow>
</template>

<style>
.vue-flow__edges {
  z-index: 1000 !important;
}
</style>
