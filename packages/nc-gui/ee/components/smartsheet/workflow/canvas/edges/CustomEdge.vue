<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@vue-flow/core'
import type { Position } from '@vue-flow/core'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import Dropdown from '~/components/smartsheet/workflow/canvas/nodes/Dropdown.vue'
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  sourceX: {
    type: Number,
    required: true,
  },
  sourceY: {
    type: Number,
    required: true,
  },
  targetX: {
    type: Number,
    required: true,
  },
  targetY: {
    type: Number,
    required: true,
  },
  sourcePosition: {
    type: String as () => Position,
    required: true,
  },
  targetPosition: {
    type: String as () => Position,
    required: true,
  },
  source: {
    type: String,
    required: true,
  },
  target: {
    type: String,
    required: true,
  },
  sourceHandle: {
    type: String,
    default: null,
  },
  targetHandle: {
    type: String,
    default: null,
  },
  targetNode: {
    type: Object,
    default: null,
  },
  label: {
    type: String,
    default: null,
  },
  labelStyle: {
    type: Object,
    default: () => ({}),
  },
  labelBgStyle: {
    type: Object,
    default: () => ({}),
  },
  style: {
    type: Object,
    default: () => ({}),
  },
  markerEnd: {
    type: String,
    default: null,
  },
})

const { insertNodeBetween, getNodeMetaById, viewingExecution, activeTab, isWorkflowEditAllowed } = useWorkflowOrThrow()

const { $e } = useNuxtApp()

const isEditMode = computed(() => activeTab.value === 'editor' && !viewingExecution.value && isWorkflowEditAllowed.value)

const path = computed(() =>
  getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition as Position,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition as Position,
  }),
)

const edgePath = computed(() => path.value[0])
const labelX = computed(() => path.value[1])
const labelY = computed(() => path.value[2])

const showPlusButton = computed(() => {
  return props.targetNode?.type !== GeneralNodeID.PLUS && isEditMode.value
})

const selectNodeType = async (option: WorkflowNodeDefinition) => {
  const nodeMeta = getNodeMetaById(option.id)
  if (!nodeMeta) return

  await insertNodeBetween(props.id, option.id, nodeMeta)

  $e('a:workflow:node:add', {
    node_type: option.id,
    node_category: option.category,
  })
}
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <BaseEdge :id="id" :style="style" :path="edgePath" :marker-end="markerEnd" />

  <EdgeLabelRenderer>
    <div
      v-if="showPlusButton"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        pointerEvents: 'all',
      }"
      class="flex items-center z-20 justify-center"
    >
      <Dropdown :category="[WorkflowNodeCategory.ACTION, WorkflowNodeCategory.FLOW]" @select="selectNodeType">
        <template #default="{ openDropdown }">
          <button
            class="edge-add-button group w-6 h-6 bg-nc-bg-default hover:bg-nc-bg-gray-light border-nc-border-brand hover:scale-110 border-nc-border-gray-medium border-1 rounded-full cursor-pointer flex items-center justify-center transition-all duration-200 transition-ease-in-out"
            title="Add node"
            @click="openDropdown"
          >
            <GeneralIcon class="text-nc-content-gray-muted group-hover:text-nc-content-brand" icon="ncPlus" />
          </button>
        </template>
      </Dropdown>
    </div>

    <div
      v-if="label"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, ${showPlusButton ? '-120%' : '-100%'}) translate(${labelX}px,${labelY}px)`,
        pointerEvents: 'all',
        ...(labelStyle || {}),
      }"
      class="text-body text-nc-content-gray-muted"
    >
      <div
        :style="{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          ...(labelBgStyle || { background: 'var(--nc-bg-default)' }),
        }"
      >
        {{ label }}
      </div>
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped lang="scss">
.edge-add-button {
  box-shadow: 0 2px 4px rgba(var(--rgb-base), 0.1);

  &:hover {
    box-shadow: 0 4px 8px rgba(var(--rgb-base), 0.15);
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>
