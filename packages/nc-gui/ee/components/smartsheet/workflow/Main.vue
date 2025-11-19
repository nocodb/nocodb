<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'

import { useLayout } from './useLayout'
import TriggerNode from '~/components/smartsheet/workflow/Node/Trigger.vue'
import WorkflowNode from '~/components/smartsheet/workflow/Node/WorkflowNode.vue'
import PlusNode from '~/components/smartsheet/workflow/Node/Plus.vue'
import Sidebar from '~/components/smartsheet/workflow/Sidebar/index.vue'
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const { layout } = useLayout()

const { fitView, nodesDraggable, edgesUpdatable } = useVueFlow()

const { nodes, edges, setLayoutCallback, nodeTypes: rawNodeTypes, workflow } = useWorkflowOrThrow()

const nodeTypes = computed(() => {
  const types: Record<string, any> = {}

  rawNodeTypes.value.forEach((nodeType: WorkflowNodeDefinition) => {
    if (nodeType.id === GeneralNodeID.PLUS) {
      types[nodeType.id] = markRaw(PlusNode)
    } else if (nodeType.category === WorkflowNodeCategory.TRIGGER) {
      types[nodeType.id] = markRaw(TriggerNode)
    } else {
      types[nodeType.id] = markRaw(WorkflowNode)
    }
  })

  return types
})

async function layoutGraph() {
  nodes.value = layout(nodes.value, edges.value, 'TB')

  nextTick(() => {
    fitView({
      padding: 0.2,
      duration: 200,
      minZoom: 0.1,
      maxZoom: 1,
    })
  })
}

onMounted(() => {
  nodesDraggable.value = false
  edgesUpdatable.value = false

  setLayoutCallback(layoutGraph)

  nextTick(() => {
    setTimeout(() => {
      layoutGraph()
    }, 100)
  })
})

watch(
  () => workflow.value?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      nextTick(() => {
        setTimeout(() => {
          layoutGraph()
        }, 100)
      })
    }
  },
)
</script>

<template>
  <div class="flex h-full w-full">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :zoom-on-scroll="false"
      zoom-on-pinch
      :zoom-on-double-click="false"
      :pan-on-scroll="false"
      auto-pan-on-connect
      :default-zoom="1"
      fit-view-on-init
      :delete-key-code="null"
      class="workflow-canvas"
    >
    </VueFlow>
    <Sidebar />
  </div>
</template>

<style scoped>
.workflow-canvas {
  flex: 1;
  height: 100%;
}
</style>

<style>
@import '@vue-flow/minimap/dist/style.css';

/* Fix handle z-index to appear on top of nodes */
.vue-flow__handle {
  z-index: 10 !important;
  pointer-events: none !important;
}
</style>
