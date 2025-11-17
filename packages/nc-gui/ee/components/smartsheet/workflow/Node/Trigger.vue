<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import NodeTypeDropdown, { type NodeTypeOption } from './NodeTypeDropdown.vue'

const props = defineProps<NodeProps>()

const workflowStore = useWorkflowOrThrow()
const { updateNode, addPlusNode, triggerLayout, getNodeType, selectedNodeId } = workflowStore

const availableOptions = computed((): NodeTypeOption[] => {
  const triggerTypes = workflowStore.getNodeTypesByCategory(WorkflowCategory.TRIGGER)
  return triggerTypes.map((nt) => ({
    id: nt.type,
    title: nt.title,
    icon: nt.icon,
    description: nt.description,
  }))
})

const selectTriggerType = async (option: NodeTypeOption) => {
  updateNode(props.id, {
    type: option.id,
    data: {
      ...props.data,
    },
  })

  const hasPlusNode = workflowStore.edges.value.some((e) => e.source === props.id)
  if (!hasPlusNode) {
    await addPlusNode(props.id)

    await nextTick()
    setTimeout(() => {
      triggerLayout()
    }, 50)
  }
}

const nodeMeta = computed(() => {
  return getNodeType(props.type)
})

const handleTriggerClick = (event: MouseEvent) => {
  if (props.type !== 'core.trigger' && nodeMeta.value) {
    event.stopPropagation()
    selectedNodeId.value = props.id
  }
}
</script>

<template>
  <div class="trigger-node-wrapper">
    <NodeTypeDropdown
      :options="availableOptions"
      :selected-id="props.type === 'core.trigger' ? undefined : props.type"
      placeholder="When this happens"
      title="Choose a trigger"
      overlay-class-name="nc-dropdown-trigger-selection"
      @select="selectTriggerType"
    >
      <template #default="{ selectedOption: selected, openDropdown }">
        <div
          class="trigger-node"
          :class="{
            'trigger-node-selected': selected,
            'trigger-node-empty': !selected,
          }"
          @click="selected ? handleTriggerClick($event) : openDropdown()"
        >
          <div class="trigger-content">
            <div v-if="!selected" class="trigger-placeholder">
              <div class="trigger-placeholder-icon">
                <GeneralIcon icon="plus" class="text-neutral-400" />
              </div>
              <span class="trigger-placeholder-text">When this happens</span>
            </div>
            <div v-else class="trigger-selected">
              <div class="trigger-selected-icon">
                <GeneralIcon :icon="selected.icon" />
              </div>
              <div class="trigger-text-container">
                <span class="trigger-label">{{ selected.title }}</span>
                <span class="trigger-instance-title">{{ data.title }}</span>
              </div>
            </div>
          </div>

          <!-- Handle for connecting to next node -->
          <Handle type="source" :position="Position.Bottom" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />
        </div>
      </template>
    </NodeTypeDropdown>
  </div>
</template>

<style scoped lang="scss">
.trigger-node-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.trigger-node {
  width: 400px;
  min-height: 80px;
  background: white;
  border: 2px solid #3b82f6;
  border-radius: 12px;
  padding: 24px 20px 16px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
}

.trigger-node-empty {
  border-style: dashed;
  border-color: #d1d5db;
  cursor: pointer;
}

.trigger-node-selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.trigger-node:hover {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.trigger-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  width: 100%;
}

.trigger-placeholder {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trigger-placeholder-icon {
  width: 48px;
  height: 48px;
  background: #f3f4f6;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trigger-placeholder-text {
  font-size: 18px;
  font-weight: 500;
  color: #3b82f6;
}

.trigger-selected {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.trigger-selected-icon {
  width: 40px;
  height: 40px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  flex-shrink: 0;
}

.trigger-text-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0; // Enable text truncation
}

.trigger-label {
  font-size: 14px;
  font-weight: 400;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trigger-instance-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<style lang="scss">
:deep(.nc-dropdown-trigger-selection) {
  .ant-dropdown-menu {
    padding: 0;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
}
</style>
