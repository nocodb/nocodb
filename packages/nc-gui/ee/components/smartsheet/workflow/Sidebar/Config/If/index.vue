<script setup lang="ts">
import { WorkflowNodeComparisonOp } from 'nocodb-sdk'
import type { WorkflowNodeConditionGroup, WorkflowNodeConditionItem, WorkflowNodeFilterCondition } from 'nocodb-sdk'
import ConditionItemRenderer from '~/components/smartsheet/workflow/Sidebar/Config/If/ConditionItemRenderer.vue'

interface IfNodeConfig {
  conditions: WorkflowNodeConditionItem[]
}

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const { t } = useI18n()

const workflowContext = inject(WorkflowVariableInj, null)

const isConditionDropdownOpen = ref(false)

const config = computed<IfNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {
    conditions: [],
  }) as IfNodeConfig
})

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const isWorkflowNodeConditionGroup = (item: WorkflowNodeConditionItem): item is WorkflowNodeConditionGroup => {
  return 'is_group' in item && item.is_group === true
}

const conditionsCount = computed(() => {
  const countItems = (items: WorkflowNodeConditionItem[]): number => {
    return items.reduce((count, item) => {
      if (isWorkflowNodeConditionGroup(item)) {
        return count + countItems(item.children)
      }
      return count + 1
    }, 0)
  }
  return countItems(config.value.conditions)
})

const updateConfig = (newConfig: IfNodeConfig) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: newConfig,
    },
  })
}

const addCondition = (parentPath: number[] = []) => {
  const newCondition: WorkflowNodeFilterCondition = {
    field: '',
    comparison_op: WorkflowNodeComparisonOp.EQ,
    value: '',
    logical_op: 'and',
  }

  const newConditions = JSON.parse(JSON.stringify(config.value.conditions))

  if (parentPath.length === 0) {
    if (newConditions.length > 0) {
      const firstItem = newConditions[0]
      newCondition.logical_op = isWorkflowNodeConditionGroup(firstItem) ? firstItem.logical_op : firstItem.logical_op || 'and'
    }
    newConditions.push(newCondition)
  } else {
    let current: any = newConditions
    for (let i = 0; i < parentPath.length; i++) {
      if (isWorkflowNodeConditionGroup(current[parentPath[i]])) {
        if (i === parentPath.length - 1) {
          const group = current[parentPath[i]]
          if (group.children.length > 0) {
            const firstChild = group.children[0]
            newCondition.logical_op = isWorkflowNodeConditionGroup(firstChild)
              ? firstChild.logical_op
              : firstChild.logical_op || 'and'
          }
          current[parentPath[i]].children.push(newCondition)
          break
        }
        current = current[parentPath[i]].children
      }
    }
  }

  updateConfig({ ...config.value, conditions: newConditions })
}

const addGroup = (parentPath: number[] = []) => {
  const newGroup: WorkflowNodeConditionGroup = {
    is_group: true,
    logical_op: 'and',
    children: [],
  }

  const newConditions = JSON.parse(JSON.stringify(config.value.conditions))

  if (parentPath.length === 0) {
    // Inherit logical_op from first condition if exists
    if (newConditions.length > 0) {
      const firstItem = newConditions[0]
      newGroup.logical_op = isWorkflowNodeConditionGroup(firstItem) ? firstItem.logical_op : firstItem.logical_op || 'and'
    }
    newConditions.push(newGroup)
  } else {
    let current: any = newConditions
    for (let i = 0; i < parentPath.length; i++) {
      if (isWorkflowNodeConditionGroup(current[parentPath[i]])) {
        if (i === parentPath.length - 1) {
          // Inherit logical_op from first child if exists
          const group = current[parentPath[i]]
          if (group.children.length > 0) {
            const firstChild = group.children[0]
            newGroup.logical_op = isWorkflowNodeConditionGroup(firstChild)
              ? firstChild.logical_op
              : firstChild.logical_op || 'and'
          }
          current[parentPath[i]].children.push(newGroup)
          break
        }
        current = current[parentPath[i]].children
      }
    }
  }

  updateConfig({ ...config.value, conditions: newConditions })
}

const removeWorkflowNodeConditionItem = (path: number[]) => {
  const newConditions = JSON.parse(JSON.stringify(config.value.conditions))

  if (path.length === 1) {
    newConditions.splice(path[0], 1)
  } else {
    let current: any = newConditions
    for (let i = 0; i < path.length - 1; i++) {
      if (isWorkflowNodeConditionGroup(current[path[i]])) {
        current = current[path[i]].children
      }
    }
    current.splice(path[path.length - 1], 1)
  }

  updateConfig({ ...config.value, conditions: newConditions })
}

const updateWorkflowNodeConditionItem = (
  path: number[],
  updates: Partial<WorkflowNodeFilterCondition | WorkflowNodeConditionGroup>,
) => {
  const newConditions = JSON.parse(JSON.stringify(config.value.conditions))

  let current: any = newConditions
  for (let i = 0; i < path.length - 1; i++) {
    if (isWorkflowNodeConditionGroup(current[path[i]])) {
      current = current[path[i]].children
    } else {
      return
    }
  }

  const index = path[path.length - 1]
  current[index] = { ...current[index], ...updates }

  updateConfig({ ...config.value, conditions: newConditions })
}

const updateAllSiblings = (path: number[], logicalOp: 'and' | 'or') => {
  const newConditions = JSON.parse(JSON.stringify(config.value.conditions))

  let current: any = newConditions
  for (let i = 0; i < path.length - 1; i++) {
    if (isWorkflowNodeConditionGroup(current[path[i]])) {
      current = current[path[i]].children
    }
  }

  current.forEach((item: WorkflowNodeConditionItem) => {
    if (isWorkflowNodeConditionGroup(item)) {
      item.logical_op = logicalOp
    } else {
      item.logical_op = logicalOp
    }
  })

  updateConfig({ ...config.value, conditions: newConditions })
}
</script>

<template>
  <div class="if-node-config">
    <div class="px-4 py-3">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-nc-content-gray-emphasis">Conditions</label>

        <NcDropdown
          v-model:visible="isConditionDropdownOpen"
          placement="bottomLeft"
          overlay-class-name="nc-if-conditions-dropdown"
        >
          <div
            class="h-9 border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-sm"
            :class="{
              '!border-nc-border-brand shadow-selected': isConditionDropdownOpen,
              'border-nc-border-gray-medium': !isConditionDropdownOpen,
              'bg-nc-bg-brand-light': conditionsCount > 0,
            }"
          >
            <div
              class="nc-conditions-count flex-1"
              :class="{
                'text-nc-content-brand': conditionsCount > 0,
                'text-nc-content-gray-muted': conditionsCount === 0,
              }"
            >
              {{ conditionsCount > 0 ? `${conditionsCount} condition${conditionsCount !== 1 ? 's' : ''}` : 'No conditions' }}
            </div>

            <GeneralIcon
              icon="ncChevronDown"
              class="flex-none w-4 h-4"
              :class="{
                'text-nc-content-brand': conditionsCount > 0,
                'text-nc-content-gray-muted': conditionsCount === 0,
              }"
            />
          </div>

          <template #overlay>
            <div class="nc-if-conditions-dropdown-container">
              <div v-if="config.conditions.length === 0" class="p-4">
                <div class="flex">
                  <NcButton type="text" size="small" @click="addCondition()">
                    <template #icon>
                      <GeneralIcon icon="ncPlus" class="w-4 h-4" />
                    </template>
                    {{ t('activity.addFilter') }}
                  </NcButton>
                  <NcButton type="text" size="small" @click="addGroup()">
                    <template #icon>
                      <GeneralIcon icon="ncPlus" class="w-4 h-4" />
                    </template>
                    {{ t('activity.addFilterGroup') }}
                  </NcButton>
                </div>

                <div class="text-nc-content-gray-disabled mt-2 ml-0.5">
                  {{ $t('title.noFiltersAdded') }}
                </div>
              </div>

              <div v-else class="p-3">
                <div class="space-y-2 mb-3">
                  <ConditionItemRenderer
                    v-for="(item, index) in config.conditions"
                    :key="index"
                    :item="item"
                    :path="[index]"
                    :nested-level="0"
                    :grouped-variables="groupedVariables"
                    :flat-variables="flatVariables"
                    @update="updateWorkflowNodeConditionItem"
                    @update-all-siblings="updateAllSiblings"
                    @add-condition="addCondition"
                    @add-group="addGroup"
                    @remove="removeWorkflowNodeConditionItem"
                  />
                </div>

                <div class="flex gap-2 align-self">
                  <NcButton type="text" size="small" @click="addCondition()">
                    <template #icon>
                      <GeneralIcon icon="ncPlus" class="w-4 h-4" />
                    </template>
                    {{ t('activity.addFilter') }}
                  </NcButton>
                  <NcButton type="text" size="small" @click="addGroup()">
                    <template #icon>
                      <GeneralIcon icon="ncPlus" class="w-4 h-4" />
                    </template>
                    {{ t('activity.addFilterGroup') }}
                  </NcButton>
                </div>
              </div>
            </div>
          </template>
        </NcDropdown>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-if-conditions-dropdown {
  @apply !min-w-[600px] !max-w-[800px];

  .ant-dropdown-menu {
    @apply !p-0;
  }
}
</style>

<style scoped lang="scss">
.if-node-config {
  :deep(.ant-select-selector) {
    @apply !min-h-8;
  }
}

.nc-if-conditions-dropdown-container {
  @apply max-h-[500px] overflow-y-auto;
}
</style>
