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

const { $destroy, fitView, onPaneReady, viewport, onNodeDoubleClick } = useVueFlow({ minZoom: 0.1, maxZoom: 2 })

const { layout, elements } = useErdElements(tables, config)

const showSkeleton = computed(() => viewport.value.zoom < 0.2)

function init() {
  layout(showSkeleton.value)
  if (!showSkeleton.value) {
    setTimeout(zoomIn, 100)
  }
}

function zoomIn(nodeId?: string) {
  fitView({ nodes: nodeId ? [nodeId] : undefined, duration: 300, minZoom: 0.3 })
}

onPaneReady(() => {
  layout(showSkeleton.value)

  setTimeout(() => {
    fitView({ duration: 250, padding: 0.5 })
  }, 100)
})

onNodeDoubleClick(({ node }) => {
  if (showSkeleton.value) zoomIn()

  setTimeout(() => {
    zoomIn(node.id)
  }, 250)
})

watch(tables, init)
watch(showSkeleton, (isSkeleton) => {
  layout(isSkeleton)
  setTimeout(() => {
    fitView({
      duration: 300,
      minZoom: isSkeleton ? undefined : viewport.value.zoom,
      maxZoom: isSkeleton ? viewport.value.zoom : undefined,
    })
  }, 100)
})

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

    <Transition name="layout">
      <div
        v-if="showSkeleton && config.showAllColumns"
        class="color-transition z-5 cursor-pointer absolute bottom-4 left-[50%] transform translate-x-[-50%] text-slate-400 hover:(text-slate-900 ring ring-accent ring-opacity-100) font-semibold px-4 py-2 bg-slate-100/50 hover:bg-slate-100/90 rounded"
        @click="zoomIn"
      >
        Zoom in to view columns
      </div>
    </Transition>
  </VueFlow>
</template>

<style>
.vue-flow__edges {
  z-index: 1000 !important;
}
</style>
