<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'

import TriggerNode from './Node/Trigger.vue'
import WorkflowNode from './Node/WorkflowNode.vue'
import PlusNode from './Node/Plus.vue'

import { useLayout } from './useLayout'
import Sidebar from '~/components/smartsheet/workflow/Sidebar/index.vue'
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const { layout } = useLayout()

const { fitView, nodesDraggable, edgesUpdatable } = useVueFlow()

const { nodes, edges, setLayoutCallback, nodeTypes: rawNodeTypes, workflow } = useWorkflowOrThrow()

const nodeTypes = computed(() => {
  const types: Record<string, any> = {}

  rawNodeTypes.value.forEach((nodeType) => {
    if (nodeType.type === 'core.plus') {
      types[nodeType.type] = markRaw(PlusNode)
    } else if (nodeType.category === WorkflowCategory.TRIGGER) {
      types[nodeType.type] = markRaw(TriggerNode)
    } else {
      types[nodeType.type] = markRaw(WorkflowNode)
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

/* const handleRun = async () => {

  try {
    // Call backend to execute workflow
    const response = await api.instance.post(
      `/api/v2/internal/${activeProjectId.value}/${activeProjectId.value}?operation=workflowExecute`,
      {
        workflowId: activeWorkflow.value.id,
        triggerData: {
          // You can pass trigger data here if needed
          timestamp: Date.now(),
        },
        // triggerNodeTitle: 'Trigger', // Optional: specify which trigger to start from
      },
    )

    const executionState = response.data

    if (executionState.status === 'completed') {
      const duration = ((executionState.endTime - executionState.startTime) / 1000).toFixed(2)
      const nodesCount = executionState.nodeResults.length
      message.success(`Workflow executed successfully in ${duration}s (${nodesCount} nodes executed)`)

      // Log results for debugging
      console.log('[Workflow] Execution completed:', executionState)
    } else if (executionState.status === 'error') {
      const errorNode = executionState.nodeResults.find((r: any) => r.status === 'error')
      const errorMessage = errorNode ? `Node "${errorNode.nodeTitle}" failed: ${errorNode.error}` : 'Workflow execution failed'
      message.error(errorMessage)
      console.error('[Workflow] Execution error:', executionState)
    }
  } catch (error: any) {
    console.error('[Workflow] Execution failed:', error)
    message.error(`Workflow execution failed: ${error.message || 'Unknown error'}`)
  } finally {
    isRunning.value = false
  }
} */

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
      :zoom-on-pinch="false"
      :zoom-on-double-click="false"
      :pan-on-scroll="false"
      :default-zoom="1"
      :min-zoom="1"
      :max-zoom="1"
      :fit-view-on-init="true"
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
