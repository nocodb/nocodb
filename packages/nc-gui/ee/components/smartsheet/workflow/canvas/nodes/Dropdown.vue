<script setup lang="ts">
import type { WorkflowNodeCategoryType, WorkflowNodeDefinition } from 'nocodb-sdk'
import { GeneralNodeID, WorkflowNodeCategory } from 'nocodb-sdk'
import { onClickOutside } from '@vueuse/core'

interface Props {
  category: Array<WorkflowNodeCategoryType>
  selectedId?: string
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ select: [option: WorkflowNodeDefinition] }>()

const { nodeTypes } = useWorkflowOrThrow()
const showDropdown = ref(false)
const dropdownRef = ref()

const selectNodeOption = (option: WorkflowNodeDefinition & { locked?: boolean; requiredPlan?: string }) => {
  if (option.locked) {
    return
  }

  emit('select', option)
  showDropdown.value = false
}

// Group nodes by category
const nodesByCategory = computed(() => {
  return props.category.reduce((acc, category) => {
    const nodes = nodeTypes.value.filter((node) => node.category === category && !Object.values(GeneralNodeID).includes(node.id))
    if (nodes.length > 0) acc[category] = nodes
    return acc
  }, {} as Record<WorkflowNodeCategoryType, WorkflowNodeDefinition[]>)
})

// Separate core nodes from integration packages
const categorizedNodes = computed(() => {
  const result = {} as Record<
    WorkflowNodeCategoryType,
    {
      core: WorkflowNodeDefinition[]
      packages: Record<string, { title: string; icon?: string; nodes: WorkflowNodeDefinition[] }>
    }
  >

  Object.entries(nodesByCategory.value).forEach(([category, nodes]) => {
    const core: WorkflowNodeDefinition[] = []
    const packages = {} as Record<string, { title: string; icon?: string; nodes: WorkflowNodeDefinition[] }>

    nodes.forEach((node) => {
      if (!node.package) {
        core.push(node)
      } else {
        const { name, title, icon } = node.package
        if (!packages[name]) packages[name] = { title, icon, nodes: [] }
        packages[name].nodes.push(node)
      }
    })

    result[category as WorkflowNodeCategoryType] = { core, packages }
  })

  return result
})

const selectedNode = computed(() => {
  if (!props.selectedId) return null

  for (const nodes of Object.values(nodesByCategory.value)) {
    const found = nodes.find((node) => node.id === props.selectedId)
    if (found) return found
  }
  return null
})

const getNodeIconClass = (category: WorkflowNodeCategoryType) => ({
  'bg-nc-bg-brand text-nc-content-brand-disabled': [WorkflowNodeCategory.TRIGGER, WorkflowNodeCategory.ACTION].includes(category),
  'bg-nc-bg-maroon-dark text-nc-content-maroon-dark': category === WorkflowNodeCategory.FLOW,
})

onClickOutside(
  dropdownRef,
  (event) => {
    const target = event.target as HTMLElement
    if (!target.closest('.ant-dropdown') && showDropdown.value) {
      showDropdown.value = false
    }
  },
  { ignore: ['.ant-dropdown', '.node-sidebar', '.nc-dropdown', '.tippy-box', '.loop-selector'] },
)
</script>

<template>
  <NcDropdown ref="dropdownRef" v-model:visible="showDropdown" :disabled="disabled">
    <slot :selected-node="selectedNode" :show-dropdown="showDropdown" :open-dropdown="() => (showDropdown = true)" />

    <template #overlay>
      <NcMenu class="w-77" variant="medium">
        <template v-for="(data, _category, index) in categorizedNodes" :key="_category">
          <NcMenuItemLabel class="!capitalize">{{ _category }}</NcMenuItemLabel>
          <NcMenuItem
            v-for="node in data.core"
            :key="node.id"
            :class="{
              'locked-node': (node as any).locked,
              '!cursor-not-allowed': (node as any).locked,
            }"
            inner-class="w-full"
            @click="selectNodeOption(node)"
          >
            <div class="flex gap-2 items-center justify-between w-full">
              <div class="flex flex-1 gap-2 items-center">
                <div :class="getNodeIconClass(node.category)" class="w-6 h-6 flex items-center justify-center rounded-md p-1">
                  <GeneralIcon :icon="node.icon" class="!w-5 !h-5 stroke-transparent" />
                </div>
                <div :class="{'opacity-50': (node as any).locked,}" class="text-nc-content-gray text-caption">
                  {{ node.title }}
                </div>
              </div>
              <PaymentUpgradeBadge
                v-if="(node as any).locked"
                :content="`Upgrade to ${(node as any).requiredPlan} plan to use ${node.title} node`"
                :plan-title="(node as any).requiredPlan"
              />
            </div>
          </NcMenuItem>
          <template v-if="Object.keys(data.packages).length">
            <NcDivider v-if="data.core.length" />
            <NcMenuItemLabel class="!capitalize">Integrations</NcMenuItemLabel>
            <NcSubMenu v-for="(pkg, pkgName) in data.packages" :key="`${_category}-${pkgName}`">
              <template #title>
                <div class="flex gap-2 items-center">
                  <GeneralIcon v-if="pkg.icon" :icon="pkg.icon" class="!w-5 !h-5 stroke-transparent" />
                  <span>{{ pkg.title }}</span>
                </div>
              </template>
              <NcMenuItem
                v-for="node in pkg.nodes"
                :key="node.id"
                :class="{
                  'locked-node': (node as any).locked,
                  '!cursor-not-allowed': (node as any).locked,
                }"
                inner-class="w-full"
                class="w-65"
                @click="selectNodeOption(node)"
              >
                <div class="flex gap-2 items-center justify-between w-full">
                  <div class="flex gap-2 flex-1 items-center">
                    <div :class="getNodeIconClass(node.category)" class="w-6 h-6 flex items-center justify-center rounded-md p-1">
                      <GeneralIcon :icon="node.icon" class="!w-5 !h-5 stroke-transparent" />
                    </div>
                    <div :class="{'opacity-50': (node as any).locked,}" class="text-nc-content-gray text-caption">
                      {{ node.title }}
                    </div>
                  </div>
                  <PaymentUpgradeBadge
                    v-if="(node as any).locked"
                    :content="`Upgrade to ${(node as any).requiredPlan} plan to use ${node.title} node`"
                    :plan-title="(node as any).requiredPlan"
                  />
                </div>
              </NcMenuItem>
            </NcSubMenu>
          </template>

          <NcDivider v-if="index < Object.keys(categorizedNodes).length - 1" />
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
.locked-node {
  &:hover {
    background-color: rgba(251, 146, 60, 0.1) !important;
    cursor: not-allowed !important;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(251, 146, 60, 0.03) 10px,
      rgba(251, 146, 60, 0.03) 20px
    );
    pointer-events: none;
  }
}
</style>
