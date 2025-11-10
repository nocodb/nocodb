<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Background } from '@vue-flow/background'

// Node components
import TriggerNode from './node/Trigger.vue'
import WorkflowNode from './node/WorkflowNode.vue'
import PlusNode from './node/Plus.vue'
import Topbar from './Topbar.vue'

import { useLayout } from './useLayout'
import { useWorkflowValidation } from './useWorkflowValidation'
import { WorkflowCategory, useProvideWorkflowStore } from './useWorkflow'

const { layout } = useLayout()
const { validateWorkflow } = useWorkflowValidation()

const { fitView, nodesDraggable, edgesUpdatable } = useVueFlow()

// Get workflow data from store
const workflowStoreApi = useWorkflowStore()
const { activeWorkflow } = storeToRefs(workflowStoreApi)
const { updateWorkflow } = workflowStoreApi
const { activeProjectId } = storeToRefs(useBases())

// Get initial workflow data
const initialWorkflow = computed(() => {
  if (!activeWorkflow.value?.nodes || !activeWorkflow.value?.edges) return undefined

  return {
    nodes: activeWorkflow.value.nodes,
    edges: activeWorkflow.value.edges,
  }
})

// Provide workflow store to child components
const workflowStore = useProvideWorkflowStore(initialWorkflow.value)
const { nodes, edges, setLayoutCallback, saveWorkflow, isSaving, workflowNodeTypes } = workflowStore

// Dynamically map node types to components based on their category
// This is reactive and updates when node types are loaded from backend
const nodeTypes = computed(() => {
  const types: Record<string, any> = {}

  // Get all available node types from the workflow store
  workflowNodeTypes.value.forEach((nodeType) => {
    // Special case: core.plus gets its own dedicated component for linear workflow
    if (nodeType.type === 'core.plus') {
      types[nodeType.type] = markRaw(PlusNode)
    }
    // Map trigger types to TriggerNode component
    else if (nodeType.category === WorkflowCategory.TRIGGER) {
      types[nodeType.type] = markRaw(TriggerNode)
    }
    // All other categories (ACTION, LOGIC, etc.) use WorkflowNode
    else {
      types[nodeType.type] = markRaw(WorkflowNode)
    }
  })

  return types
})

async function layoutGraph() {
  nodes.value = layout(nodes.value, edges.value, 'TB')

  nextTick(() => {
    // Fit the view to show all nodes with padding
    fitView({
      padding: 0.2, // 20% padding around the workflow
      duration: 200, // Smooth animation
      minZoom: 0.1, // Allow zooming out if needed to fit all nodes
      maxZoom: 1, // Don't zoom in beyond 100%
    })
  })
}

/**
 * Handle save button click - save workflow to backend
 */
const handleSave = async () => {
  if (!activeProjectId.value || !activeWorkflow.value?.id) {
    message.error('No active workflow found')
    return
  }

  await saveWorkflow(async (workflowData) => {
    // Save nodes and edges to backend
    await updateWorkflow(activeProjectId.value!, activeWorkflow.value!.id, {
      nodes: workflowData.nodes,
      edges: workflowData.edges,
    })
  })
}

/**
 * Check if workflow is valid for execution
 */
const isWorkflowValid = computed(() => {
  return validateWorkflow(nodes.value).valid
})

const workflowTitle = computed(() => activeWorkflow.value?.title || 'Untitled Workflow')

onMounted(() => {
  nodesDraggable.value = false
  edgesUpdatable.value = false

  // Register layout callback for child components
  setLayoutCallback(layoutGraph)

  // Wait for Vue Flow to fully initialize before running layout
  nextTick(() => {
    // Additional delay to ensure all nodes are rendered with proper dimensions
    setTimeout(() => {
      layoutGraph()
    }, 100)
  })
})

// Watch for workflow changes and re-layout
watch(
  () => activeWorkflow.value?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Workflow changed, wait for nodes to update and then layout
      nextTick(() => {
        setTimeout(() => {
          layoutGraph()
        }, 100)
      })
    }
  },
)

// Expose methods for parent components
defineExpose({
  handleSave,
  isWorkflowValid,
})
</script>

<template>
  <div class="workflow-container">
    <Topbar :title="workflowTitle" :is-saving="isSaving" @save="handleSave" />
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
      <Background pattern-color="#aaa" :gap="16" />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style scoped>
.workflow-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #f9fafb;
}

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
