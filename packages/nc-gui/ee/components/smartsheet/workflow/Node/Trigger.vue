<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position } from '@vue-flow/core'
import Dropdown from './Dropdown.vue'

const props = defineProps<NodeProps>()

const { updateNode, addPlusNode, triggerLayout, getNodeType, selectedNodeId, edges, deleteNode } = useWorkflowOrThrow()

const wrappperRef = ref()

const showSubMenuDropdown = ref()

const nodeMeta = computed(() => {
  return getNodeType(props.type)
})

const disableDropdown = computed(() => {
  return !!(props.type !== 'core.trigger' && nodeMeta.value)
})

const selectTriggerType = async (option: WorkflowNodeType) => {
  updateNode(props.id, {
    type: option.type,
    data: {
      ...props.data,
    },
  })

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
  if (props.type !== 'core.trigger' && nodeMeta.value) {
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

onClickOutside(
  wrappperRef,
  () => {
    showSubMenuDropdown.value = false
    if (selectedNodeId.value === props.id) {
      selectedNodeId.value = null
    }
  },
  {
    ignore: ['.node-sidebar'],
  },
)
</script>

<template>
  <div ref="wrappperRef" class="trigger-node-wrapper">
    <Dropdown
      :disabled="disableDropdown"
      :selected-id="props.type === 'core.trigger' ? undefined : props.type"
      :category="[WorkflowCategory.TRIGGER]"
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
          class="flex border-1 w-77 rounded-lg cursor-pointer border-nc-border-gray-medium p-3 bg-nc-bg-default"
          :class="{
            'ring ring-nc-brand-500 ring-offset-2': selectedNodeId === props.id || showDropdown,
          }"
          @click.stop="handleTriggerClick"
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
    <Handle type="source" :position="Position.Bottom" class="!w-3 !h-3 !border-none !bg-transparent" />
  </div>
</template>
