<script setup lang="ts">
import { Background, Controls, Panel, PanelPosition } from '@vue-flow/additional-components'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { TableType } from 'nocodb-sdk'
import type { ERDConfig } from './utils'
import { useErdElements, useLayout } from './utils'
import { computed, onBeforeUnmount, toRefs, watch } from '#imports'

interface Props {
  tables: TableType[]
  config: ERDConfig
}

const props = defineProps<Props>()

const { tables, config } = toRefs(props)

const { $destroy, fitView, onNodesInitialized, viewport, onNodeDoubleClick } = useVueFlow({ minZoom: 0.05, maxZoom: 2 })

const { elements } = useErdElements(tables, config)

const showSkeleton = computed(() => viewport.value.zoom < 0.15)

const layout = useLayout(showSkeleton)

function zoomIn(nodeId?: string) {
  fitView({ nodes: nodeId ? [nodeId] : undefined, duration: 300, minZoom: 0.2 })
}

onNodesInitialized(() => {
  setTimeout(() => {
    layout()

    fitView({ duration: 250, minZoom: 0.16 })
  }, 100)
})

onNodeDoubleClick(({ node }) => {
  if (showSkeleton.value) zoomIn()

  setTimeout(
    () => {
      zoomIn(node.id)
    },
    showSkeleton.value ? 250 : 0,
  )
})

watch(
  tables,
  () => {
    setTimeout(() => {
      layout()

      if (!showSkeleton.value) {
        setTimeout(zoomIn, 100)
      }
    }, 0)
  },
  { flush: 'post' },
)

watch(
  config,
  () => {
    setTimeout(() => {
      layout()

      if (!showSkeleton.value) fitView({ duration: 250, minZoom: 0.16 })
    }, 100)
  },
  { deep: true },
)

watch(showSkeleton, (isSkeleton) => {
  setTimeout(() => {
    layout()

    fitView({
      duration: 300,
      minZoom: isSkeleton ? undefined : viewport.value.zoom,
      maxZoom: isSkeleton ? viewport.value.zoom : undefined,
    })
  }, 100)
})

onBeforeUnmount($destroy)
</script>

<template>
  <VueFlow v-model="elements">
    <Controls class="rounded" :position="PanelPosition.BottomLeft" :show-fit-view="false" :show-interactive="false" />

    <template #node-custom="{ data, dragging }">
      <ErdTableNode :config="config" :data="data" :dragging="dragging" :show-skeleton="showSkeleton" />
    </template>

    <template #edge-custom="edgeProps">
      <ErdRelationEdge v-bind="edgeProps" :show-skeleton="showSkeleton" />
    </template>

    <Background :size="showSkeleton ? 2 : undefined" :gap="showSkeleton ? 50 : undefined" />

    <Transition name="layout">
      <Panel
        v-if="showSkeleton && config.showAllColumns"
        :position="PanelPosition.BottomCenter"
        class="color-transition z-5 cursor-pointer rounded shadow-sm text-slate-400 font-semibold px-4 py-2 bg-slate-100/50 hover:(text-slate-900 ring ring-accent ring-opacity-100 bg-slate-100/90)"
        @click="zoomIn"
      >
        <!-- todo: i18n -->
        Zoom in to view columns
      </Panel>
    </Transition>

    <slot />
  </VueFlow>
</template>

<style>
.vue-flow__edges {
  @apply !z-1000;
}

.vue-flow__controls-zoomin {
  @apply rounded-t;
}

.vue-flow__controls-zoomout {
  @apply rounded-b;
}
</style>
