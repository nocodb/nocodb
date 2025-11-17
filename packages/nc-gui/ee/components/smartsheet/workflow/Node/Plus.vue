<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import NodeTypeDropdown, { type NodeTypeOption } from './NodeTypeDropdown.vue'

const props = defineProps<NodeProps>()

const { getNodeType, getNodeTypesByCategory, updateNode, addPlusNode, triggerLayout, edges } = useWorkflowOrThrow()

const availableOptions = computed((): NodeTypeOption[] => {
  const actionTypes = getNodeTypesByCategory(WorkflowCategory.ACTION)
  const logicTypes = getNodeTypesByCategory(WorkflowCategory.LOGIC)

  const allTypes = [...actionTypes, ...logicTypes]

  return allTypes.map((nt) => ({
    id: nt.type,
    title: nt.title,
    icon: nt.icon,
    description: nt.description,
  }))
})

const selectNodeType = async (option: NodeTypeOption) => {
  updateNode(props.id, {
    type: option.id,
    data: {
      ...props.data,
    },
  })

  // Check if the selected node type has multiple outputs (like if/else)
  const selectedNodeMeta = getNodeType(option.id)

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
  <div class="plus-node-wrapper">
    <Handle type="target" :position="Position.Top" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />

    <NodeTypeDropdown
      :options="availableOptions"
      placeholder="What happens next?"
      title="Choose an action or condition"
      overlay-class-name="nc-dropdown-plus-selection"
      @select="selectNodeType"
    >
      <template #default="{ openDropdown }">
        <div class="plus-node plus-node-empty" @click="openDropdown">
          <div class="plus-content">
            <div class="plus-placeholder">
              <div class="plus-placeholder-icon">
                <GeneralIcon icon="plus" class="text-neutral-400" />
              </div>
              <span class="plus-placeholder-text">What happens next?</span>
            </div>
          </div>
        </div>
      </template>
    </NodeTypeDropdown>
  </div>
</template>

<style scoped lang="scss">
.plus-node-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.plus-node {
  width: 400px;
  height: 80px;
  background: white;
  border: 2px solid #10b981;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
}

.plus-node-empty {
  border-style: dashed;
  border-color: #d1d5db;
}

.plus-node:hover {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.plus-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 28px;
}

.plus-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plus-placeholder-icon {
  width: 32px;
  height: 32px;
  background: #f3f4f6;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plus-placeholder-text {
  font-size: 15px;
  font-weight: 500;
  color: #10b981;
}
</style>

<style lang="scss">
:deep(.nc-dropdown-plus-selection) {
  .ant-dropdown-menu {
    padding: 0;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
  }
}
</style>
