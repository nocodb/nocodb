<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position } from '@vue-flow/core'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'
import Dropdown from './Dropdown.vue'

const props = defineProps<NodeProps>()

const { updateNode, addPlusNode, triggerLayout, getNodeMetaById, selectedNodeId, edges, deleteNode, updateSelectedNode } =
  useWorkflowOrThrow()

const wrappperRef = ref()

const showSubMenuDropdown = ref()

const nodeMeta = computed(() => {
  return getNodeMetaById(props.type)
})

const disableDropdown = computed(() => {
  return !!(props.type !== GeneralNodeID.TRIGGER && nodeMeta.value)
})

const selectTriggerType = async (option: WorkflowNodeDefinition) => {
  await updateNode(props.id, {
    type: option.id,
    data: {
      ...props.data,
    },
  })

  updateSelectedNode(props.id)

  const hasPlusNode = edges.value.some((e) => e.source === props.id)
  if (!hasPlusNode) {
    await addPlusNode(props.id)

    await nextTick()
    setTimeout(() => {
      triggerLayout()
    }, 50)
  }
}

const handleTriggerClick = () => {
  if (props.type !== GeneralNodeID.TRIGGER && nodeMeta.value) {
    selectedNodeId.value = props.id
  }
}

const handleDelete = async () => {
  await deleteNode(props.id)

  await nextTick()
  setTimeout(() => {
    triggerLayout()
  }, 50)
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
  <div ref="wrappperRef" class="trigger-node-wrapper">
    <Dropdown
      :disabled="disableDropdown"
      :selected-id="props.type === 'core.trigger' ? undefined : props.type"
      :category="[WorkflowNodeCategory.TRIGGER]"
      @select="selectTriggerType"
    >
      <template #default="{ selectedNode, openDropdown, showDropdown }">
        <div
          v-if="!selectedNode"
          :class="{
            'ring ring-nc-brand-500 ring-offset-2': showDropdown,
          }"
          class="flex border-1 rounded-lg w-77 justify-center border-dashed cursor-pointer border-nc-border-gray-dark px-2 py-4 !bg-nc-bg-gray-extralight"
          @click="openDropdown"
        >
          <div class="flex text-nc-content-brand items-center gap-2">
            <GeneralIcon icon="ncPlus" class="w-4 h-4" />
            <span class="text-captionBold">
              {{ $t('labels.addTrigger') }}
            </span>
          </div>
        </div>
        <div
          v-else
          class="flex border-1 w-77 rounded-lg cursor-pointer border-nc-border-gray-medium p-3 bg-nc-bg-default relative"
          :class="{
            'ring ring-nc-brand-500 ring-offset-2': selectedNodeId === props.id || showDropdown,
          }"
          @click.stop="handleTriggerClick"
        >
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
    <Handle type="source" :position="Position.Bottom" class="!w-3 !h-3 !border-none !bg-transparent" />
  </div>
</template>
