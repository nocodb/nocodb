<script setup lang="ts">
import type { WorkflowNodeCategoryType, WorkflowNodeDefinition } from 'nocodb-sdk'
import { WorkflowNodeCategory } from 'nocodb-sdk'
import { onClickOutside } from '@vueuse/core'
import { computed } from 'vue'

interface Props {
  category: Array<WorkflowNodeCategoryType>
  selectedId?: string
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [option: WorkflowNodeDefinition]
}>()

const { getNodeTypesByCategory } = useWorkflowOrThrow()

const showDropdown = ref(false)

const dropdownRef = ref()

const selectNodeOption = (option: WorkflowNodeDefinition) => {
  emit('select', option)
  showDropdown.value = false
}

const nodeByCategory = computed(() => {
  return props.category.reduce((acc, cate) => {
    const nodes = getNodeTypesByCategory(cate)
    if (nodes.length > 0) {
      acc[cate] = nodes
    }
    return acc
  }, {} as Record<WorkflowNodeCategoryType, WorkflowNodeDefinition[]>)
})

const selectedNode = computed(() => {
  if (props.selectedId) {
    for (const category in nodeByCategory.value) {
      const nodes = nodeByCategory.value[category as WorkflowNodeCategoryType]
      const found = nodes.find((node) => node.id === props.selectedId)
      if (found) return found
    }
  }
  return null
})

onClickOutside(
  dropdownRef,
  (event) => {
    const target = event.target as HTMLElement
    const isInsideOverlay = target.closest('.ant-dropdown')

    if (!isInsideOverlay && showDropdown.value) {
      showDropdown.value = false
    }
  },
  { ignore: ['.ant-dropdown', '.node-sidebar', '.nc-dropdown', '.tippy-box'] },
)
</script>

<template>
  <NcDropdown ref="dropdownRef" v-model:visible="showDropdown" :disabled="disabled">
    <slot
      :selected-node="selectedNode"
      :show-dropdown="showDropdown"
      :open-dropdown="
        () => {
          showDropdown = true
        }
      "
    >
    </slot>
    <template #overlay>
      <NcMenu variant="medium">
        <template v-for="(nodes, cate, index) in nodeByCategory" :key="cate">
          <NcMenuItemLabel class="!capitalize"> {{ cate }} </NcMenuItemLabel>
          <NcMenuItem v-for="node in nodes" :key="node.title" @click="selectNodeOption(node)">
            <div class="flex gap-2 items-center">
              <div
                :class="{
                  'bg-nc-bg-brand !text-nc-content-brand-disabled': [
                    WorkflowNodeCategory.TRIGGER,
                    WorkflowNodeCategory.ACTION,
                  ].includes(node.category),
                  'bg-nc-bg-maroon ': node.category === WorkflowNodeCategory.FLOW,
                }"
                class="w-5 h-5 flex items-center justify-center rounded-md p-1"
              >
                <GeneralIcon :icon="node.icon" class="!w-4 !h-4 !stroke-2" />
              </div>

              <div class="text-nc-content-gray text-captionDropdownDefault">
                {{ node.title }}
              </div>
            </div>
          </NcMenuItem>

          <NcDivider v-if="index < Object.keys(nodeByCategory).length - 1" />
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss"></style>
