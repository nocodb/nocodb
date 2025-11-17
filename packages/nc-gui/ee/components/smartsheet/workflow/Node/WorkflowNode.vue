<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import NodeTypeDropdown, { type NodeTypeOption } from './NodeTypeDropdown.vue'

const props = defineProps<NodeProps>()

const workflowStore = useWorkflowOrThrow()
const { getNodeType, getNodeTypesByCategory, updateNode, addPlusNode, triggerLayout, deleteNode } = workflowStore

// Get metadata for this node using the type
const nodeMeta = computed(() => {
  return getNodeType(props.type)
})

// Determine the category for this node to get available options
const availableOptions = computed((): NodeTypeOption[] => {
  if (!nodeMeta.value) return []

  const nodeTypes = getNodeTypesByCategory(nodeMeta.value.category)
  return nodeTypes.map((nt) => ({
    id: nt.type, // Use the type as the id
    title: nt.title,
    icon: nt.icon,
    description: nt.description,
  }))
})

// Get color scheme based on category
const colorScheme = computed(() => {
  if (!nodeMeta.value) return { border: '#d1d5db', bg: 'rgba(209, 213, 219, 0.1)' }

  switch (nodeMeta.value.category) {
    case WorkflowCategory.ACTION:
      return { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
    case WorkflowCategory.LOGIC:
      return { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
    default:
      return { border: '#d1d5db', bg: 'rgba(209, 213, 219, 0.1)' }
  }
})

// Placeholder text based on category
const placeholderText = computed(() => {
  if (!nodeMeta.value) return 'Select an option'

  switch (nodeMeta.value.category) {
    case WorkflowCategory.ACTION:
      return 'Do this'
    case WorkflowCategory.LOGIC:
      return 'Add logic'
    default:
      return 'Select an option'
  }
})

// Title for dropdown
const dropdownTitle = computed(() => {
  if (!nodeMeta.value) return 'Choose an option'

  switch (nodeMeta.value.category) {
    case WorkflowCategory.ACTION:
      return 'Choose an action'
    case WorkflowCategory.LOGIC:
      return 'Choose logic'
    default:
      return 'Choose an option'
  }
})

const selectNodeType = async (option: NodeTypeOption) => {
  // Update the node type
  updateNode(props.id, {
    type: option.id,
    data: {
      ...props.data,
    },
  })

  // Check if the selected option is a logic node with multiple outputs
  const selectedNodeMeta = getNodeType(option.id)

  // If a node type is being selected for the first time from core.plus
  if (props.type === 'core.plus') {
    // Check if this node already has connections
    const hasOutputs = workflowStore.edges.value.some((e) => e.source === props.id)

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

// Check if node has input/output handles
const hasInput = computed(() => {
  return true // All workflow nodes have input (they come after triggers)
})

const hasOutput = computed(() => {
  return nodeMeta.value?.output !== 0
})

const handleDelete = async () => {
  deleteNode(props.id)

  // Wait for Vue Flow and layout to process
  await nextTick()
  setTimeout(() => {
    triggerLayout()
  }, 50)
}

// Handle node click to open configuration drawer
const handleNodeClick = (event: MouseEvent) => {
  // Only open drawer if a node type is selected (not core.plus)
  if (props.type !== 'core.plus' && nodeMeta.value) {
    // Prevent opening dropdown when clicking on the node
    event.stopPropagation()
    //  openConfigDrawer(props.id)
  }
}
</script>

<template>
  <div class="workflow-node-wrapper">
    <!-- Input handle -->
    <Handle v-if="hasInput" type="target" :position="Position.Top" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />

    <NodeTypeDropdown
      :options="availableOptions"
      :selected-id="props.type === 'core.plus' ? undefined : type"
      :placeholder="placeholderText"
      :title="dropdownTitle"
      :show-delete="props.type !== 'core.plus'"
      overlay-class-name="nc-dropdown-node-selection"
      @select="selectNodeType"
      @delete="handleDelete"
    >
      <template #default="{ selectedOption: selected }">
        <div
          class="node-container"
          :class="{
            'node-selected': selected,
            'node-empty': !selected,
          }"
          :style="{
            borderColor: selected ? colorScheme.border : '#d1d5db',
          }"
          @click="handleNodeClick"
        >
          <div class="node-content">
            <div v-if="!selected" class="node-placeholder">
              <div class="node-placeholder-icon">
                <GeneralIcon icon="plus" class="text-neutral-400" />
              </div>
              <span class="node-placeholder-text" :style="{ color: colorScheme.border }">
                {{ placeholderText }}
              </span>
            </div>
            <div v-else class="node-selected-content">
              <div class="node-icon" :style="{ background: colorScheme.bg, color: colorScheme.border }">
                <GeneralIcon :icon="selected.icon" />
              </div>
              <div class="node-text-container">
                <span class="node-label">{{ selected.title }}</span>
                <span class="node-instance-title">{{ data.title }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </NodeTypeDropdown>

    <!-- Output handle -->
    <Handle v-if="hasOutput" type="source" :position="Position.Bottom" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />
  </div>
</template>

<style scoped lang="scss">
.workflow-node-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.node-container {
  width: 400px;
  min-height: 80px;
  background: white;
  border: 2px solid;
  border-radius: 12px;
  padding: 24px 20px 16px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
}

.node-empty {
  border-style: dashed;
  border-color: #d1d5db;
  cursor: pointer;
}

.node-selected {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.node-container:hover {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.node-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  width: 100%;
}

.node-placeholder {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-placeholder-icon {
  width: 48px;
  height: 48px;
  background: #f3f4f6;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-placeholder-text {
  font-size: 18px;
  font-weight: 500;
}

.node-selected-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.node-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-text-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0; // Enable text truncation
}

.node-label {
  font-size: 14px;
  font-weight: 400;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-instance-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<style lang="scss">
:deep(.nc-dropdown-node-selection) {
  .ant-dropdown-menu {
    padding: 0;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
}
</style>
