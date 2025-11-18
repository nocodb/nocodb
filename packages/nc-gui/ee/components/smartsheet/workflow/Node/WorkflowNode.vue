<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import Dropdown from '~/components/smartsheet/workflow/Node/Dropdown.vue'

const props = defineProps<NodeProps>()

const { getNodeType, updateNode, addPlusNode, triggerLayout, deleteNode, selectedNodeId, edges } = useWorkflowOrThrow()

const nodeMeta = computed(() => {
  return getNodeType(props.type)
})

const wrappperRef = ref()

const showSubMenuDropdown = ref()

const hasOutput = computed(() => {
  return nodeMeta.value?.output !== 0
})

const disableDropdown = computed(() => {
  return !!(props.type !== 'core.plus' && nodeMeta.value)
})

const selectNodeType = async (option: WorkflowNodeType) => {
  await updateNode(props.id, {
    type: option.type,
    data: {
      ...props.data,
    },
  })

  const selectedNodeMeta = getNodeType(option.type)

  if (props.type === 'core.plus') {
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
  if (props.type !== 'core.plus' && nodeMeta.value) {
    selectedNodeId.value = props.id
  }
}

onClickOutside(wrappperRef, () => {
  showSubMenuDropdown.value = false
  if (selectedNodeId.value === props.id) {
    selectedNodeId.value = null
  }
})
</script>

<template>
  <div ref="wrappperRef" class="workflow-node-wrapper">
    <Handle type="target" :position="Position.Top" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />
    <Dropdown
      :disabled="disableDropdown"
      :selected-id="type === 'core.plus' ? undefined : type"
      :category="[WorkflowCategory.ACTION, WorkflowCategory.LOGIC, WorkflowCategory.CONTROL]"
      @select="selectNodeType"
    >
      <template #default="{ openDropdown, showDropdown, selectedNode }">
        <div
          v-if="selectedNode"
          :class="{
            'ring ring-nc-brand-500 ring-offset-2': selectedNodeId === id || showDropdown,
          }"
          class="flex border-1 rounded-lg w-77 justify-center cursor-pointer border-nc-border-gray-medium p-3 bg-nc-bg-default"
          @click.stop="handleNodeClick"
        >
          <div class="flex gap-2.5 w-full items-center">
            <div
              :class="{
                'bg-nc-bg-brand !text-nc-content-brand-disabled': [
                  WorkflowCategory.TRIGGER,
                  WorkflowCategory.CONTROL,
                  WorkflowCategory.ACTION,
                ].includes(selectedNode.category),
                'bg-nc-bg-maroon ': selectedNode.category === WorkflowCategory.LOGIC,
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
