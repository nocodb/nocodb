<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/additional-components'
import { type Edge, type Node } from './useLayoutHelper'
import type { ColumnType } from 'nocodb-sdk'
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

const { zoomOut } = useVueFlow()

const { nodes, edges } = toRefs(props)

watch(
  () => props.elementWatch,
  () => {
    zoomOut()
  },
)
</script>

<template>
  <VueFlow
    :key="edges.length"
    class="w-full h-full"
    :nodes="nodes"
    :edges="edges"
    :nodes-draggable="false"
    :nodes-connectable="false"
  >
    <Background />
    <template #node-default="{ data, sourcePosition, targetPosition }">
      <ProcessNode
        :record="data"
        :source-position="sourcePosition"
        :target-position="targetPosition"
        :coverImageFieldId="coverImageFieldId"
        :selectedCoverImageField="selectedCoverImageField"
        :hierarchyData="hierarchyData"
        :nodeSelected="nodeSelected"
      />
    </template>
  </VueFlow>
</template>
