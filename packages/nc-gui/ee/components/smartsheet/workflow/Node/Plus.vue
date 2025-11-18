<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import Dropdown from '~/components/smartsheet/workflow/Node/Dropdown.vue'

const props = defineProps<NodeProps>()

const { getNodeType, updateNode, addPlusNode, triggerLayout, edges } = useWorkflowOrThrow()

const selectNodeType = async (option: WorkflowNodeType) => {
  updateNode(props.id, {
    type: option.type,
    data: {
      ...props.data,
    },
  })

  // Check if the selected node type has multiple outputs (like if/else)
  const selectedNodeMeta = getNodeType(option.type)

  // Check if this node already has connections
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
      // Regular node, add single plus node to maintain linear flow
      addPlusNode(props.id)
    }

    // Wait for Vue Flow and layout to process
    await nextTick()
    setTimeout(() => {
      triggerLayout()
    }, 50)
  }
}
</script>

<template>
  <div ref="wrappperRef" class="plus-node-wrapper">
    <Handle type="target" :position="Position.Top" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />
    <Dropdown
      :selected-id="props.type === 'core.trigger' ? undefined : props.type"
      :category="[WorkflowCategory.ACTION, WorkflowCategory.LOGIC, WorkflowCategory.CONTROL]"
      @select="selectNodeType"
    >
      <template #default="{ openDropdown, showDropdown }">
        <div
          :class="{
            'ring ring-nc-brand-500 ring-offset-2': showDropdown,
          }"
          class="flex border-1 rounded-lg w-77 justify-center border-dashed cursor-pointer border-nc-border-gray-dark px-2 py-4 !bg-nc-bg-gray-extralight"
          @click="openDropdown"
        >
          <div class="flex text-nc-content-brand items-center gap-2">
            <GeneralIcon icon="ncPlus" class="w-4 h-4" />
            <span class="text-captionBold">
              {{ $t('labels.addAction') }}
            </span>
          </div>
        </div>
      </template>
    </Dropdown>
  </div>
</template>
