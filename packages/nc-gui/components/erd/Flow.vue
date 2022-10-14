<script setup lang="ts">
import { Background, Controls } from '@vue-flow/additional-components'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { TableType } from 'nocodb-sdk'
import type { ErdFlowConfig } from './utils'
import { useErdElements } from './utils'
import { onScopeDispose, toRefs, watch } from '#imports'

interface Props {
  tables: TableType[]
  config: ErdFlowConfig
}

const props = defineProps<Props>()

const { tables, config } = toRefs(props)

const { $destroy, fitView, onPaneReady } = useVueFlow({ minZoom: 0.15, maxZoom: 2 })

const { layout, elements } = useErdElements(tables, config)

function init() {
  layout()
  setTimeout(() => {
    fitView({ duration: 500 })
  }, 100)
}

onPaneReady(init)

watch(tables, init, { flush: 'post' })
watch(config, init, { flush: 'post', deep: true })

onScopeDispose($destroy)
</script>

<template>
  <VueFlow v-model="elements">
    <Controls position="top-right" :show-fit-view="false" :show-interactive="false" />

    <template #node-custom="{ data }">
      <ErdTableNode :data="data" />
    </template>

    <template #edge-custom="edgeProps">
      <ErdRelationEdge v-bind="edgeProps" />
    </template>

    <Background />

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
