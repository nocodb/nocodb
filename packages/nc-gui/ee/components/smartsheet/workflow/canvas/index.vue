<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { computed, markRaw } from 'vue'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'
import PlusNode from '~/components/smartsheet/workflow/canvas/nodes/Plus.vue'
import TriggerNode from '~/components/smartsheet/workflow/canvas/nodes/Trigger.vue'
import WorkflowNode from '~/components/smartsheet/workflow/canvas/nodes/WorkflowNode.vue'
import { useWorkflowOrThrow } from '~/composables/useWorkflow'
import { useLayout } from '~/components/smartsheet/workflow/useLayout'
import ManualTrigger from '~/components/smartsheet/workflow/canvas/ManualTrigger.vue'
import { Background } from '@vue-flow/background'

const { nodes, edges, setLayoutCallback, nodeTypes: rawNodeTypes, workflow } = useWorkflowOrThrow()

const { fitView, nodesDraggable, edgesUpdatable } = useVueFlow()

const { layout } = useLayout()

const initNode = ref<boolean>(true)

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

  if (initNode.value) {
    initNode.value = false
    nextTick(() => {
      fitView({
        padding: 0.2,
        duration: 200,
        minZoom: 0.1,
        maxZoom: 1,
      })
    })
  }
}

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
</script>

<template>
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
    <Background />
  </VueFlow>

  <ManualTrigger />
</template>

<style scoped lang="scss">
.workflow-canvas {
  flex: 1;
  height: 100%;
}
</style>
