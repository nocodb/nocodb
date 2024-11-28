<script setup lang="ts">
import { Background, Controls, Panel, PanelPosition } from '@vue-flow/additional-components'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { AiBaseSchema, AiERDConfig } from './utils'
import { useErdElements } from './utils'

interface Props {
  aiBaseSchema: AiBaseSchema
  config: AiERDConfig
}

const props = defineProps<Props>()

const { aiBaseSchema, config } = toRefs(props)

const {
  $destroy,
  fitView,
  viewport,
  setMaxZoom,
  onNodeDoubleClick,
  zoomIn: internalZoomIn,
  zoomOut: internalZoomOut,
} = useVueFlow({ minZoom: 0.05, maxZoom: 2 })

const { layout, elements } = useErdElements(aiBaseSchema, config)

const showSkeleton = computed(() => viewport.value.zoom < 0.15)

async function init() {
  // TODO fit view after first render
  fitView({ duration: 0, minZoom: 0.2 })
  layout(showSkeleton.value)
}

function zoomIn(nodeId?: string) {
  fitView({ nodes: nodeId ? [nodeId] : undefined, duration: 200, minZoom: 0.2 })
}

onNodeDoubleClick(({ node }) => {
  if (showSkeleton.value) zoomIn()

  setTimeout(() => {
    zoomIn(node.id)
  }, 250)
})

watch(aiBaseSchema, init, { flush: 'post', immediate: true })

watch(showSkeleton, async (isSkeleton) => {
  layout(isSkeleton).then(() => {
    if (!isSkeleton) return
    fitView({
      duration: 300,
      minZoom: isSkeleton ? undefined : viewport.value.zoom,
      maxZoom: isSkeleton ? viewport.value.zoom : undefined,
    })
  })
})

watch(elements, (elements) => {
  if (elements.length > 3) {
    setMaxZoom(2)
  } else {
    setMaxZoom(1.25)
  }
})

onScopeDispose($destroy)
</script>

<template>
  <VueFlow v-model="elements">
    <Controls
      class="bg-transparent rounded-lg shadow-md border-1 border-gray-200 !right-13 flex items-center"
      :position="PanelPosition.TopRight"
      :show-fit-view="false"
      :show-interactive="false"
    >
      <template #control-zoom-in>
        <div class="nc-erd-zoom-btn rounded-l-lg h-9 !px-2 flex items-center" @click="internalZoomIn">
          <GeneralIcon icon="plus" />
        </div>
      </template>
      <template #control-zoom-out>
        <div class="nc-erd-zoom-btn border-l-1 border-gray-200 rounded-r-lg h-9 !px-2 flex items-center" @click="internalZoomOut">
          <GeneralIcon icon="minus" />
        </div>
      </template>
    </Controls>

    <template #node-custom="{ data, dragging }">
      <AiErdTableNode :data="data" :dragging="dragging" :show-skeleton="showSkeleton" />
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
        {{ $t('labels.zoomInToViewColumns') }}
      </Panel>
    </Transition>

    <slot />
  </VueFlow>
</template>

<style>
.vue-flow__controls {
  @apply !bg-transparent;
}

.nc-erd-zoom-btn {
  @apply bg-white px-1.5 py-1 hover:(bg-gray-100 text-gray-800) cursor-pointer text-gray-600;
}
</style>
