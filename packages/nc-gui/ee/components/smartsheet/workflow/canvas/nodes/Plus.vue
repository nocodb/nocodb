<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import Dropdown from '~/components/smartsheet/workflow/canvas/nodes/Dropdown.vue'

const props = defineProps<NodeProps>()

const { $e } = useNuxtApp()

const { updateNode, selectedNodeId } = useWorkflowOrThrow()

const selectNodeType = async (option: WorkflowNodeDefinition) => {
  await updateNode(props.id, {
    type: option.id,
    data: {
      ...props.data,
    },
  })

  $e('a:workflow:node:add', {
    node_type: option.id,
    node_category: option.category,
  })

  selectedNodeId.value = props.id
}
</script>

<template>
  <div ref="wrappperRef" class="plus-node-wrapper">
    <Handle type="target" :position="Position.Top" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />
    <Dropdown
      :selected-id="props.type === GeneralNodeID.TRIGGER ? undefined : props.type"
      :category="[WorkflowNodeCategory.ACTION, WorkflowNodeCategory.FLOW]"
      @select="selectNodeType"
    >
      <template #default="{ openDropdown, showDropdown }">
        <div
          :class="{
            'ring ring-nc-brand-500 ring-offset-2.5 ring-1.5': showDropdown,
          }"
          class="flex border-1 rounded-lg w-77 bg-nc-bg-default justify-center border-dashed cursor-pointer border-nc-border-gray-dark px-2 py-4"
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
