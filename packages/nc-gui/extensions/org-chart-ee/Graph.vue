<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background, Controls, PanelPosition } from '@vue-flow/additional-components'
import type { ColumnType } from 'nocodb-sdk'
import { type Edge, type Node } from './useLayoutHelper'
import ProcessNode from './ProcessNode.vue'

const props = defineProps<{
  nodes: Node[]
  edges: Edge[]
  /** Element to watch, trigger fitView when changed */
  fullscreen: boolean
  coverImageFieldId?: string
  selectedCoverImageField?: ColumnType
  hierarchyData: Map<string, string[]>
  nodeSelected: (nodeId: string) => void
  displayValueCol?: ColumnType
}>()

const { nodes, edges } = toRefs(props)

const { $destroy, fitView, zoomOut: internalZoomOut } = useVueFlow()

const isFullScreen = ref(false)

const vueFlowKey = computed(() => {
  return `org_chart_${nodes.value.length}_${edges.value.length}_${props.fullscreen}${Math.floor(Math.random() * 99999)}`
})

const isFlowReady = ref(false)

const zoomOut = async (useDelay = false) => {
  await nextTick()

  if (useDelay) {
    await ncDelay(500)
  }

  fitView()
  internalZoomOut()
}

const toggleFullScreen = () => {
  isFullScreen.value = !isFullScreen.value

  zoomOut(true)
}

watch(
  () => props.fullscreen,
  () => {
    if (!isFlowReady.value) return

    zoomOut(true)
  },
)

onScopeDispose($destroy)
</script>

<template>
  <Teleport to="body" :disabled="!isFullScreen">
    <div
      class="w-full bg-white h-full"
      :class="{
        '!z-1100 !h-screen !w-screen fixed top-0 left-0 right-0 bottom-0': isFullScreen,
      }"
      :style="!isFullScreen ? 'height: inherit' : ''"
    >
      <div class="relative h-full">
        <VueFlow
          :key="vueFlowKey"
          class="w-full h-full"
          :nodes="nodes"
          :edges="edges"
          @nodes-initialized="zoomOut()"
          fit-view-on-init
          @init="isFlowReady = true"
          :nodes-draggable="false"
          :nodes-connectable="false"
        >
          <Background />
          <template #node-default="{ data, sourcePosition, targetPosition }">
            <ProcessNode
              :record="data"
              :source-position="sourcePosition"
              :target-position="targetPosition"
              :cover-image-field-id="coverImageFieldId"
              :selected-cover-image-field="selectedCoverImageField"
              :hierarchy-data="hierarchyData"
              :node-selected="nodeSelected"
              :display-value-col="displayValueCol"
            />
          </template>

          <ErdFullScreenToggle
            :config="{
              isFullScreen,
            }"
            @toggle-full-screen="toggleFullScreen"
          />

          <Controls
            class="bg-transparent rounded-lg shadow-md border-1 border-gray-200 !right-13 flex items-center"
            :position="PanelPosition.TopRight"
            :show-fit-view="false"
            :show-interactive="false"
          >
            <template>
              <div class="nc-erd-zoom-btn rounded-l-lg h-9 !px-2 flex items-center">
                <GeneralIcon icon="plus" />
              </div>
            </template>
          </Controls>
        </VueFlow>
      </div>
    </div>
  </Teleport>
</template>
