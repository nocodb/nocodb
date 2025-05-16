<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/additional-components'
import type { ColumnType } from 'nocodb-sdk'
import { type Edge, type Node } from './useLayoutHelper'
import ProcessNode from './ProcessNode.vue'

const props = defineProps<{
  nodes: Node[]
  edges: Edge[]
  /** Element to watch, trigger fitView when changed */
  elementWatch: any
  coverImageFieldId?: string
  selectedCoverImageField?: ColumnType
  hierarchyData: Map<string, string[]>
  nodeSelected: (nodeId: string) => void
  displayValueCol?: ColumnType
}>()

const { $destroy, fitView, zoomIn: internalZoomIn, zoomOut: internalZoomOut } = useVueFlow()

const { nodes, edges } = toRefs(props)

const vueFlowKey = computed(() => {
  return `org_chart_${nodes.value.length}_${edges.value.length}_${props.elementWatch}${Math.floor(Math.random() * 99999)}`
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

watch(
  () => props.elementWatch,
  () => {
    if (!isFlowReady.value) return

    zoomOut(true)
  },
)

onScopeDispose($destroy)
</script>

<template>
  <VueFlow
    :key="vueFlowKey"
    class="w-full h-full"
    :nodes="nodes"
    :edges="edges"
    @nodes-initialized="zoomOut()"
    fit-view-on-init
    @init="isFlowReady = true"
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
  </VueFlow>
</template>
