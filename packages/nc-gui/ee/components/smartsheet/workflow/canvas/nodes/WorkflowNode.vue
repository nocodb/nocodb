<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position } from '@vue-flow/core'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'
import WorkflowNodeStatusIcon from './WorkflowNodeStatusIcon.vue'
import Dropdown from '~/components/smartsheet/workflow/canvas/nodes/Dropdown.vue'

const props = defineProps<NodeProps>()

const { $e } = useNuxtApp()

const { getNodeMetaById, updateNode, triggerLayout, deleteNode, selectedNodeId, viewingExecution, activeTab } =
  useWorkflowOrThrow()

const { getCurrentIteration, goToPreviousIteration, goToNextIteration, isLoopNode } = useWorkflowExecutionLoop()

const enableEditableMenu = computed(() => activeTab.value === 'editor' && !viewingExecution.value)

const findLoopData = (loopsObj: any, loopNodeId: string, parentIterations: Record<string, number> = {}): any => {
  // Check top-level loops
  if (loopsObj[loopNodeId]) {
    return loopsObj[loopNodeId]
  }

  // Recursively search in childLoops
  for (const [parentLoopId, parentLoopData] of Object.entries(loopsObj)) {
    const parentIteration = parentIterations[parentLoopId] ?? getCurrentIteration(parentLoopId)
    const iteration = (parentLoopData as any).iterations?.[parentIteration]

    if (iteration?.childLoops?.[loopNodeId]) {
      return iteration.childLoops[loopNodeId]
    }

    // Recursively search deeper
    if (iteration?.childLoops) {
      const found = findLoopData(iteration.childLoops, loopNodeId, {
        ...parentIterations,
        [parentLoopId]: parentIteration,
      })
      if (found) return found
    }
  }

  return null
}

const nodeMeta = computed(() => {
  return getNodeMetaById(props.type)
})

const wrappperRef = ref()

const showSubMenuDropdown = ref()

const hasOutput = computed(() => {
  return nodeMeta.value?.output !== 0
})

const disableDropdown = computed(() => {
  return !!(props.type !== GeneralNodeID.PLUS && nodeMeta.value) || props.readOnly
})

const selectNodeType = async (option: WorkflowNodeDefinition) => {
  await updateNode(props.id, {
    type: option.id,
    data: {},
  })

  selectedNodeId.value = props.id

  $e('a:workflow:node:select-type', {
    node_type: option.id,
    node_category: option.category,
  })
}

const handleDelete = async () => {
  $e('a:workflow:node:delete', {
    node_type: props.type,
    node_id: props.id,
  })

  await deleteNode(props.id)

  await nextTick()
  setTimeout(() => {
    triggerLayout()
  }, 50)
}

const handleNodeClick = () => {
  // Only open drawer if a node type is selected (not core.plus)
  if (props.type !== GeneralNodeID.PLUS && nodeMeta.value) {
    selectedNodeId.value = props.id
  }
}

// Check if this is a loop node (shows navigation controls)
const isThisLoopNode = computed(() => {
  return isLoopNode(props.type)
})

// Get loop execution info (only for loop nodes themselves)
const loopExecutionInfo = computed(() => {
  if (!viewingExecution.value || !isThisLoopNode.value) return null

  const executionData = viewingExecution.value.execution_data
  if (!executionData?.loops) return null

  // Find loop data (supports nested loops in childLoops)
  const loop = findLoopData(executionData.loops, props.id)
  if (loop) {
    const currentIteration = getCurrentIteration(props.id)

    return {
      totalIterations: loop.totalIterations,
      currentIteration,
    }
  }

  return null
})

// Navigation functions for loop nodes
const handlePreviousIteration = () => {
  if (loopExecutionInfo.value) {
    goToPreviousIteration(props.id)
  }
}

const handleNextIteration = () => {
  if (loopExecutionInfo.value) {
    goToNextIteration(props.id, loopExecutionInfo.value.totalIterations)
  }
}

onClickOutside(
  wrappperRef,
  () => {
    showSubMenuDropdown.value = false
    if (selectedNodeId.value === props.id) {
      selectedNodeId.value = null
    }
  },
  {
    ignore: [
      '.node-sidebar',
      '.ant-select-dropdown',
      '.ant-picker-dropdown',
      '.ant-modal',
      '.nc-dropdown',
      '.tippy-box',
      '.loop-selector',
    ],
  },
)
</script>

<template>
  <div ref="wrappperRef" class="workflow-node-wrapper relative">
    <div
      v-if="loopExecutionInfo"
      class="absolute -top-7.5 left-0 loop-selector flex items-center bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg px-1 shadow-sm z-10"
      @click.stop
    >
      <NcButton
        type="text"
        size="xxsmall"
        :disabled="loopExecutionInfo.currentIteration === 0"
        @click.stop="handlePreviousIteration"
      >
        <GeneralIcon icon="ncChevronLeft" />
      </NcButton>

      <div class="text-bodySm text-nc-content-gray-emphasis px-1 min-w-12 text-center">
        {{ loopExecutionInfo.currentIteration + 1 }} / {{ loopExecutionInfo.totalIterations }}
      </div>

      <NcButton
        type="text"
        size="xxsmall"
        :disabled="loopExecutionInfo.currentIteration >= loopExecutionInfo.totalIterations - 1"
        @click.stop="handleNextIteration"
      >
        <GeneralIcon icon="ncChevronRight" />
      </NcButton>
    </div>

    <Handle type="target" :position="Position.Top" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />
    <Dropdown
      :disabled="disableDropdown"
      :selected-id="type === GeneralNodeID.PLUS ? undefined : type"
      :category="[WorkflowNodeCategory.ACTION, WorkflowNodeCategory.FLOW]"
      @select="selectNodeType"
    >
      <template #default="{ openDropdown, showDropdown, selectedNode }">
        <div
          v-if="selectedNode"
          :class="{
            'ring ring-nc-brand-500 ring-offset-2.5 ring-1.5': selectedNodeId === id || showDropdown,
          }"
          class="flex flex-col border-1 rounded-lg w-77 justify-center cursor-pointer border-nc-border-gray-medium p-3 bg-nc-bg-default relative"
          @click.stop="handleNodeClick"
        >
          <WorkflowNodeStatusIcon :node-id="props.id" />

          <div class="flex gap-2.5 w-full items-center">
            <div
              :class="{
                'bg-nc-bg-brand text-nc-content-brand-disabled': [
                  WorkflowNodeCategory.TRIGGER,
                  WorkflowNodeCategory.ACTION,
                ].includes(selectedNode.category),
                'bg-nc-bg-maroon-dark text-nc-content-maroon-dark': selectedNode.category === WorkflowNodeCategory.FLOW,
              }"
              class="w-6 h-6 flex items-center justify-center rounded-md p-1"
            >
              <GeneralIcon :icon="selectedNode.icon" class="!w-5 !h-5 stroke-transparent" />
            </div>
            <div class="text-nc-content-gray truncate flex-1 w-full text-bodyBold">
              {{ selectedNode.title }}
            </div>

            <NcDropdown v-if="enableEditableMenu" v-model:visible="showSubMenuDropdown">
              <NcButton type="text" size="xxsmall" @click.stop>
                <GeneralIcon icon="threeDotHorizontal" />
              </NcButton>

              <template #overlay>
                <NcMenu variant="small">
                  <NcMenuItem
                    @click="
                      () => {
                        openDropdown()
                        showSubMenuDropdown = false
                      }
                    "
                  >
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncEdit" />
                      Edit
                    </div>
                  </NcMenuItem>
                  <NcDivider />
                  <NcMenuItem danger @click="handleDelete">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="delete" />
                      Delete
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
          <NcDivider />
          <div
            class="text-bodySm line-clamp-2"
            :class="{
              'text-nc-content-gray-muted': !props?.data?.description,
              'text-nc-content-gray': props?.data?.description,
            }"
          >
            {{ props?.data?.description || $t('labels.addDescription') }}
          </div>
        </div>
      </template>
    </Dropdown>
    <Handle v-if="hasOutput" type="source" :position="Position.Bottom" class="!w-3 !h-3 !border-none !bg-transparent" />
  </div>
</template>
