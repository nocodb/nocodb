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
}>()

const { fitView, zoomOut: _zoomOut } = useVueFlow()

const { nodes, edges } = toRefs(props)

const vueFlowKey = computed(() => {
  return `org_chart_${nodes.value.length}_${edges.value.length}_${Math.floor(Math.random() * 99999)}`
})

const zoomOut = async (useDelay = false) => {
  await nextTick()

  if (useDelay) {
    await ncDelay(500)
  }

  fitView()
  _zoomOut()
}

watch(
  () => props.elementWatch,
  () => {
    zoomOut(true)
  },
)
</script>

<template>
  <VueFlow
    :key="vueFlowKey"
    class="w-full h-full"
    :nodes="nodes"
    :edges="edges"
    :nodes-draggable="false"
    :nodes-connectable="false"
    @nodes-initialized="zoomOut()"
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
      />
    </template>
  </VueFlow>
</template>
