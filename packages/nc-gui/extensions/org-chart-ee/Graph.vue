<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/additional-components'
import { type Edge, type Node } from './useLayoutHelper'

const props = defineProps<{
  nodes: Node[]
  edges: Edge[]
  /** Element to watch, trigger fitView when changed */
  elementWatch: any
}>()

const { zoomOut } = useVueFlow()

watch(
  () => props.elementWatch,
  () => {
    zoomOut()
  },
)
</script>

<template>
  <VueFlow class="w-full h-full" :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false">
    <Background />
    <template #node-default="vals">
      <slot :props="vals.data" />
    </template>
  </VueFlow>
</template>
