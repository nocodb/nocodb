<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'
import Dropdown from '~/components/smartsheet/workflow/Node/Dropdown.vue'

const props = defineProps<NodeProps>()

const { getNodeMetaById, updateNode, addPlusNode, triggerLayout, deleteNode, selectedNodeId, edges, updateSelectedNode } =
  useWorkflowOrThrow()

const nodeMeta = computed(() => {
  return getNodeMetaById(props.type)
})

const wrappperRef = ref()

const showSubMenuDropdown = ref()

const hasOutput = computed(() => {
  return nodeMeta.value?.output !== 0
})

const disableDropdown = computed(() => {
  return !!(props.type !== GeneralNodeID.PLUS && nodeMeta.value)
})

const selectNodeType = async (option: WorkflowNodeDefinition) => {
  await updateNode(props.id, {
    type: option.id,
    data: {
      ...props.data,
    },
  })

  updateSelectedNode(props.id)

  const selectedNodeMeta = getNodeMetaById(option.id)

  if (props.type === GeneralNodeID.PLUS) {
    const hasOutputs = edges.value.some((e) => e.source === props.id)

    if (!hasOutputs) {
      // If it's a branch node (multiple outputs), add multiple plus nodes
      if (selectedNodeMeta?.output && selectedNodeMeta.output > 1) {
        // Add plus nodes for each output
        for (let i = 0; i < selectedNodeMeta.output; i++) {
          const label = i === 0 ? 'True' : 'False'
          addPlusNode(props.id, label)
        }
      } else {
        // Regular node, add single plus node
        addPlusNode(props.id)
      }

      // Wait for Vue Flow and layout to process
      await nextTick()
      setTimeout(() => {
        triggerLayout()
      }, 50)
    }
  }
}

const handleDelete = async () => {
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

const hasTestResult = computed(() => {
  return props.data?.testResult?.status === 'success'
})

const hasTestError = computed(() => {
  return props.data?.testResult?.status === 'error'
})

onClickOutside(
  wrappperRef,
  () => {
    showSubMenuDropdown.value = false
    if (selectedNodeId.value === props.id) {
      selectedNodeId.value = null
    }
  },
  {
    ignore: ['.node-sidebar', '.ant-select-dropdown', '.ant-picker-dropdown', '.ant-modal', '.nc-dropdown', '.tippy-box'],
  },
)
</script>

<template>
  <div ref="wrappperRef" class="workflow-node-wrapper">
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
            'ring ring-nc-brand-500 ring-offset-2': selectedNodeId === id || showDropdown,
          }"
          class="flex border-1 rounded-lg w-77 justify-center cursor-pointer border-nc-border-gray-medium p-3 bg-nc-bg-default relative"
          @click.stop="handleNodeClick"
        >
          <!-- Test status badge -->
          <div
            v-if="hasTestResult"
            class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center shadow-sm"
            title="Tested successfully"
          >
            <GeneralIcon icon="check" class="text-white !w-3 !h-3 !stroke-2" />
          </div>
          <div
            v-else-if="hasTestError"
            class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center shadow-sm"
            title="Test failed"
          >
            <GeneralIcon icon="close" class="text-white !w-3 !h-3 !stroke-2" />
          </div>

          <div class="flex gap-2.5 w-full items-center">
            <div
              :class="{
                'bg-nc-bg-brand !text-nc-content-brand-disabled': [
                  WorkflowNodeCategory.TRIGGER,
                  WorkflowNodeCategory.ACTION,
                ].includes(selectedNode.category),
                'bg-nc-bg-maroon ': selectedNode.category === WorkflowNodeCategory.FLOW,
              }"
              class="w-5 h-5 flex items-center justify-center rounded-md p-1"
            >
              <GeneralIcon :icon="selectedNode.icon" class="!w-4 !h-4 !stroke-2" />
            </div>
            <div class="text-nc-content-gray truncate flex-1 w-full text-bodyBold">
              {{ selectedNode.title }}
            </div>

            <NcDropdown v-model:visible="showSubMenuDropdown">
              <NcButton type="text" size="xxsmall" @click.stop>
                <GeneralIcon icon="threeDotHorizontal" />
              </NcButton>

              <template #overlay>
                <NcMenu variant="small">
                  <NcMenuItem @click="openDropdown">
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
        </div>
      </template>
    </Dropdown>
    <Handle v-if="hasOutput" type="source" :position="Position.Bottom" class="!w-3 !h-3 !border-none !bg-transparent" />
  </div>
</template>
