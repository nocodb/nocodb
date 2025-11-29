<script setup lang="ts">
import type {
  VariableDefinition,
  WorkflowNodeConditionGroup,
  WorkflowNodeConditionItem,
  WorkflowNodeFilterCondition,
} from 'nocodb-sdk'
import {
  WorkflowNodeComparisonOp,
  WorkflowNodeComparisonSubOp,
  WorkflowNodeFilterDataType,
  extractDataTypeFromWorkflowNodeExpression,
} from 'nocodb-sdk'
import ConditionItemRenderer from '~/components/smartsheet/workflow/Sidebar/Config/If/ConditionItemRenderer.vue'

interface Props {
  item: WorkflowNodeConditionItem
  path: number[]
  nestedLevel: number
  groupedVariables: Array<{ nodeId: string; nodeTitle: string; variables: VariableDefinition[] }>
  flatVariables: VariableDefinition[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [path: number[], updates: Partial<WorkflowNodeFilterCondition | WorkflowNodeConditionGroup>]
  updateAllSiblings: [path: number[], logicalOp: 'and' | 'or']
  addCondition: [path: number[]]
  addGroup: [path: number[]]
  remove: [path: number[]]
}>()

const { t } = useI18n()

const isFirstInGroup = computed(() => {
  return props.path[props.path.length - 1] === 0
})

const isSecondInGroup = computed(() => {
  return props.path[props.path.length - 2] === 0
})

const updateItem = (updates: Partial<WorkflowNodeFilterCondition | WorkflowNodeConditionGroup>) => {
  emit('update', props.path, updates)
}

const addCondition = () => {
  emit('addCondition', props.path)
}

const addGroup = () => {
  emit('addGroup', props.path)
}

const remove = () => {
  emit('remove', props.path)
}

const isWorkflowNodeConditionGroup = (item: WorkflowNodeConditionItem): item is WorkflowNodeConditionGroup => {
  return 'is_group' in item && item.is_group === true
}

const isGroup = computed(() => isWorkflowNodeConditionGroup(props.item))

// Type-aware comparison operations
const getWorkflowNodeComparisonOps = (dataType?: WorkflowNodeFilterDataType) => {
  const commonOps = [
    { label: 'is blank', value: WorkflowNodeComparisonOp.BLANK },
    { label: 'is not blank', value: WorkflowNodeComparisonOp.NOT_BLANK },
    { label: 'is null', value: WorkflowNodeComparisonOp.NULL },
    { label: 'is not null', value: WorkflowNodeComparisonOp.NOT_NULL },
  ]

  if (!dataType) return commonOps

  switch (dataType) {
    case WorkflowNodeFilterDataType.TEXT:
      return [
        { label: 'is equal', value: WorkflowNodeComparisonOp.EQ },
        { label: 'is not equal', value: WorkflowNodeComparisonOp.NEQ },
        { label: 'is like', value: WorkflowNodeComparisonOp.LIKE },
        { label: 'is not like', value: WorkflowNodeComparisonOp.NLIKE },
        { label: 'is empty', value: WorkflowNodeComparisonOp.EMPTY },
        { label: 'is not empty', value: WorkflowNodeComparisonOp.NOT_EMPTY },
        ...commonOps,
      ]
    case WorkflowNodeFilterDataType.NUMBER:
      return [
        { label: '=', value: WorkflowNodeComparisonOp.EQ },
        { label: '!=', value: WorkflowNodeComparisonOp.NEQ },
        { label: '>', value: WorkflowNodeComparisonOp.GT },
        { label: '<', value: WorkflowNodeComparisonOp.LT },
        { label: '>=', value: WorkflowNodeComparisonOp.GTE },
        { label: '<=', value: WorkflowNodeComparisonOp.LTE },
        ...commonOps,
      ]
    case WorkflowNodeFilterDataType.DATE:
    case WorkflowNodeFilterDataType.DATETIME:
      return [
        { label: 'is', value: WorkflowNodeComparisonOp.EQ },
        { label: 'is not', value: WorkflowNodeComparisonOp.NEQ },
        { label: 'is after', value: WorkflowNodeComparisonOp.GT },
        { label: 'is before', value: WorkflowNodeComparisonOp.LT },
        { label: 'is on or after', value: WorkflowNodeComparisonOp.GTE },
        { label: 'is on or before', value: WorkflowNodeComparisonOp.LTE },
        { label: 'is within', value: WorkflowNodeComparisonOp.IS_WITHIN },
        ...commonOps,
      ]
    case WorkflowNodeFilterDataType.BOOLEAN:
      return [
        { label: 'is checked', value: WorkflowNodeComparisonOp.CHECKED },
        { label: 'is not checked', value: WorkflowNodeComparisonOp.NOT_CHECKED },
      ]
    case WorkflowNodeFilterDataType.SELECT:
      return [
        { label: 'is', value: WorkflowNodeComparisonOp.EQ },
        { label: 'is not', value: WorkflowNodeComparisonOp.NEQ },
        { label: 'contains any of', value: WorkflowNodeComparisonOp.ANY_OF },
        { label: 'does not contain any of', value: WorkflowNodeComparisonOp.NOT_ANY_OF },
        ...commonOps,
      ]
    case WorkflowNodeFilterDataType.MULTI_SELECT:
      return [
        { label: 'contains all of', value: WorkflowNodeComparisonOp.ALL_OF },
        { label: 'contains any of', value: WorkflowNodeComparisonOp.ANY_OF },
        { label: 'does not contain all of', value: WorkflowNodeComparisonOp.NOT_ALL_OF },
        { label: 'does not contain any of', value: WorkflowNodeComparisonOp.NOT_ANY_OF },
        ...commonOps,
      ]
    case WorkflowNodeFilterDataType.JSON:
      return [
        { label: 'is equal', value: WorkflowNodeComparisonOp.EQ },
        { label: 'is not equal', value: WorkflowNodeComparisonOp.NEQ },
        ...commonOps,
      ]
    default:
      return commonOps
  }
}

// Sub-operations for date comparisons
const getSubOps = (comparisonOp: WorkflowNodeComparisonOp) => {
  if (comparisonOp === WorkflowNodeComparisonOp.IS_WITHIN) {
    return [
      { label: 'the past week', value: WorkflowNodeComparisonSubOp.PAST_WEEK, ignoreVal: true },
      { label: 'the past month', value: WorkflowNodeComparisonSubOp.PAST_MONTH, ignoreVal: true },
      { label: 'the past year', value: WorkflowNodeComparisonSubOp.PAST_YEAR, ignoreVal: true },
      { label: 'the next week', value: WorkflowNodeComparisonSubOp.NEXT_WEEK, ignoreVal: true },
      { label: 'the next month', value: WorkflowNodeComparisonSubOp.NEXT_MONTH, ignoreVal: true },
      { label: 'the next year', value: WorkflowNodeComparisonSubOp.NEXT_YEAR, ignoreVal: true },
      { label: 'the next number of days', value: WorkflowNodeComparisonSubOp.NEXT_NUMBER_OF_DAYS, ignoreVal: false },
      { label: 'the past number of days', value: WorkflowNodeComparisonSubOp.PAST_NUMBER_OF_DAYS, ignoreVal: false },
    ]
  }
  return [
    { label: 'today', value: WorkflowNodeComparisonSubOp.TODAY, ignoreVal: true },
    { label: 'tomorrow', value: WorkflowNodeComparisonSubOp.TOMORROW, ignoreVal: true },
    { label: 'yesterday', value: WorkflowNodeComparisonSubOp.YESTERDAY, ignoreVal: true },
    { label: 'one week ago', value: WorkflowNodeComparisonSubOp.ONE_WEEK_AGO, ignoreVal: true },
    { label: 'one week from now', value: WorkflowNodeComparisonSubOp.ONE_WEEK_FROM_NOW, ignoreVal: true },
    { label: 'one month ago', value: WorkflowNodeComparisonSubOp.ONE_MONTH_AGO, ignoreVal: true },
    { label: 'one month from now', value: WorkflowNodeComparisonSubOp.ONE_MONTH_FROM_NOW, ignoreVal: true },
    { label: 'number of days ago', value: WorkflowNodeComparisonSubOp.DAYS_AGO, ignoreVal: false },
    { label: 'number of days from now', value: WorkflowNodeComparisonSubOp.DAYS_FROM_NOW, ignoreVal: false },
    { label: 'exact date', value: WorkflowNodeComparisonSubOp.EXACT_DATE, ignoreVal: false },
  ]
}

const showValueInput = (condition: WorkflowNodeFilterCondition) => {
  const noValueOps = [
    WorkflowNodeComparisonOp.EMPTY,
    WorkflowNodeComparisonOp.NOT_EMPTY,
    WorkflowNodeComparisonOp.NULL,
    WorkflowNodeComparisonOp.NOT_NULL,
    WorkflowNodeComparisonOp.BLANK,
    WorkflowNodeComparisonOp.NOT_BLANK,
    WorkflowNodeComparisonOp.CHECKED,
    WorkflowNodeComparisonOp.NOT_CHECKED,
  ]

  if (noValueOps.includes(condition.comparison_op)) {
    return false
  }

  if (condition.comparison_sub_op) {
    const subOps = getSubOps(condition.comparison_op)
    const subOp = subOps.find((op) => op.value === condition.comparison_sub_op)
    return subOp ? !subOp.ignoreVal : false
  }

  return true
}

const showSubOpInput = (condition: WorkflowNodeFilterCondition) => {
  return (
    (condition.dataType === WorkflowNodeFilterDataType.DATE || condition.dataType === WorkflowNodeFilterDataType.DATETIME) &&
    [
      WorkflowNodeComparisonOp.EQ,
      WorkflowNodeComparisonOp.NEQ,
      WorkflowNodeComparisonOp.GT,
      WorkflowNodeComparisonOp.LT,
      WorkflowNodeComparisonOp.GTE,
      WorkflowNodeComparisonOp.LTE,
      WorkflowNodeComparisonOp.IS_WITHIN,
    ].includes(condition.comparison_op)
  )
}

const onFieldChange = (value: string) => {
  const updates: Partial<WorkflowNodeFilterCondition> = { field: value }

  // Auto-detect data type using expression parser
  const detectedType = extractDataTypeFromWorkflowNodeExpression(value, props.flatVariables)
  if (detectedType && !isGroup.value) {
    const condition = props.item as WorkflowNodeFilterCondition
    updates.dataType = detectedType
    const ops = getWorkflowNodeComparisonOps(detectedType)
    if (ops.length > 0 && !ops.find((op) => op.value === condition.comparison_op)) {
      updates.comparison_op = ops[0]?.value
    }
  }

  updateItem(updates)
}

const onWorkflowNodeComparisonOpChange = (comparison_op: WorkflowNodeComparisonOp) => {
  if (isGroup.value) return

  const condition = props.item as WorkflowNodeFilterCondition
  const updates: Partial<WorkflowNodeFilterCondition> = { comparison_op }
  if (!showSubOpInput({ ...condition, comparison_op })) {
    updates.comparison_sub_op = undefined
  }

  updateItem(updates)
}

// When the first condition's logical_op changes, update all siblings
const onLogicalOpChange = (logicalOp: 'and' | 'or') => {
  updateItem({ logical_op: logicalOp })

  if (!isGroup.value) {
    emit('updateAllSiblings', props.path, logicalOp)
  }
}

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]
</script>

<template>
  <div class="nc-filter-item">
    <div v-if="isGroup" class="nc-filter-group mb-2">
      <div class="flex rounded-lg p-2 border-1" :class="`nc-filter-nested-level-${nestedLevel}`">
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center gap-2 mb-2">
            <div v-if="isFirstInGroup" class="flex items-center nc-filter-where-label">
              {{ t('labels.where') }}
            </div>
            <NcSelect
              v-else
              :disabled="isSecondInGroup"
              :value="(item as WorkflowNodeConditionGroup).logical_op"
              class="!min-w-18 !max-w-18 capitalize nc-select-shadow"
              dropdown-class-name="nc-dropdown-filter-logical-op-group"
              @update:value="onLogicalOpChange"
            >
              <a-select-option v-for="op in logicalOps" :key="op.value" :value="op.value">
                <div class="flex items-center justify-between gap-2">
                  <div class="truncate flex-1 capitalize">{{ op.text }}</div>
                  <GeneralIcon
                    v-if="(item as WorkflowNodeConditionGroup).logical_op === op.value"
                    id="nc-selected-item-icon"
                    icon="ncCheck"
                    class="text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
            <div class="flex-1"></div>
            <NcButton type="text" size="small" @click="remove">
              <GeneralIcon icon="deleteListItem" />
            </NcButton>
          </div>

          <div class="space-y-1.5 ml-1">
            <ConditionItemRenderer
              v-for="(child, childIndex) in (item as WorkflowNodeConditionGroup).children"
              :key="childIndex"
              :item="child"
              :path="[...path, childIndex]"
              :nested-level="nestedLevel + 1"
              :grouped-variables="groupedVariables"
              :flat-variables="flatVariables"
              @update="(...args: Array<any>) => $emit('update', ...(args as any))"
              @update-all-siblings="(...args : Array<any>) => $emit('updateAllSiblings', ...(args as any))"
              @add-condition="(...args : Array<any>) => $emit('addCondition', ...(args as any))"
              @add-group="(...args : Array<any>) => $emit('addGroup', ...(args as any))"
              @remove="(...args : Array<any>) => $emit('remove', ...(args as any))"
            />
          </div>

          <div class="flex gap-2 ml-1">
            <NcButton type="text" size="xs" @click="addCondition">
              <GeneralIcon icon="ncPlus" class="w-4 h-4" />
              <span class="ml-1">{{ t('activity.addFilter') }}</span>
            </NcButton>
            <NcButton type="text" size="xs" @click="addGroup">
              <GeneralIcon icon="ncPlus" class="w-4 h-4" />
              <span class="ml-1">{{ t('activity.addFilterGroup') }}</span>
            </NcButton>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex gap-0 nc-filter-wrapper mb-1.5">
      <div v-if="isFirstInGroup" class="flex items-center !min-w-18 !max-w-18 nc-filter-where-label">
        {{ t('labels.where') }}
      </div>
      <NcSelect
        v-else
        :disabled="!isSecondInGroup"
        :value="(item as WorkflowNodeFilterCondition).logical_op || 'and'"
        class="h-full !max-w-18 !min-w-18 capitalize"
        dropdown-class-name="nc-dropdown-filter-logical-op"
        @update:value="onLogicalOpChange"
      >
        <a-select-option v-for="op in logicalOps" :key="op.value" :value="op.value">
          <div class="flex items-center justify-between gap-2">
            <div class="truncate flex-1 capitalize">{{ op.text }}</div>
            <GeneralIcon
              v-if="(item as WorkflowNodeFilterCondition).logical_op === op.value"
              id="nc-selected-item-icon"
              icon="ncCheck"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </NcSelect>

      <!-- Field Input -->
      <div class="nc-filter-field-input min-w-32 max-w-32">
        <NcFormBuilderInputWorkflowInput
          class="h-8"
          :model-value="(item as WorkflowNodeFilterCondition).field || ''"
          :grouped-variables="groupedVariables"
          :variables="flatVariables"
          placeholder="Select field"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Comparison Operation -->
      <NcSelect
        :value="(item as WorkflowNodeFilterCondition).comparison_op"
        class="nc-filter-comparison-op !min-w-26.75"
        :class="{
          '!max-w-26.75': !showSubOpInput(item as WorkflowNodeFilterCondition) && showValueInput(item as WorkflowNodeFilterCondition),
        }"
        dropdown-class-name="nc-dropdown-filter-comp-op !max-w-80"
        @update:value="onWorkflowNodeComparisonOpChange"
      >
        <a-select-option
          v-for="op in getWorkflowNodeComparisonOps((item as WorkflowNodeFilterCondition).dataType)"
          :key="op.value"
          :value="op.value"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="truncate flex-1">{{ op.label }}</div>
            <GeneralIcon
              v-if="(item as WorkflowNodeFilterCondition).comparison_op === op.value"
              id="nc-selected-item-icon"
              icon="ncCheck"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </NcSelect>

      <div
        v-if="!showValueInput(item as WorkflowNodeFilterCondition) && !showSubOpInput(item as WorkflowNodeFilterCondition)"
        class="flex-grow"
      ></div>
      <NcSelect
        v-else-if="showSubOpInput(item as WorkflowNodeFilterCondition)"
        :value="(item as WorkflowNodeFilterCondition).comparison_sub_op"
        class="nc-filter-sub-op min-w-28"
        :class="{
          'flex-grow w-full': !showValueInput(item as WorkflowNodeFilterCondition),
          'max-w-28': showValueInput(item as WorkflowNodeFilterCondition),
        }"
        dropdown-class-name="nc-dropdown-filter-comp-sub-op"
        @update:value="updateItem({ comparison_sub_op: $event })"
      >
        <a-select-option
          v-for="subOp in getSubOps((item as WorkflowNodeFilterCondition).comparison_op)"
          :key="subOp.value"
          :value="subOp.value"
        >
          <div class="flex items-center justify-between gap-2 max-w-40">
            <NcTooltip show-on-truncate-only class="truncate flex-1">
              <template #title>{{ subOp.label }}</template>
              {{ subOp.label }}
            </NcTooltip>
            <GeneralIcon
              v-if="(item as WorkflowNodeFilterCondition).comparison_sub_op === subOp.value"
              id="nc-selected-item-icon"
              icon="ncCheck"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </NcSelect>

      <!-- Value Input -->
      <div v-if="showValueInput(item as WorkflowNodeFilterCondition)" class="flex items-center flex-grow min-w-34">
        <NcFormBuilderInputWorkflowInput
          :model-value="(item as WorkflowNodeFilterCondition).value || ''"
          :grouped-variables="groupedVariables"
          :variables="flatVariables"
          class="h-8"
          placeholder="Enter value"
          @update:model-value="updateItem({ value: $event })"
        />
      </div>

      <!-- Remove Button -->
      <NcButton type="text" size="small" class="nc-filter-item-remove-btn self-center" @click="remove">
        <GeneralIcon icon="deleteListItem" />
      </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.nc-workflow-input) {
  .ProseMirror {
    @apply !h-8 !min-h-8 border-none !py-1;
  }

  .nc-workflow-input-insert-btn {
    @apply !-top-0.5;
  }
}

.nc-filter-item {
  @apply w-full;
}

.nc-filter-group {
  @apply w-full;
}

.nc-filter-nested-level-0 {
  @apply bg-nc-bg-gray-extralight;
}

.nc-filter-nested-level-1,
.nc-filter-nested-level-3 {
  @apply bg-nc-bg-gray-light;
}

.nc-filter-nested-level-2,
.nc-filter-nested-level-4 {
  @apply bg-nc-bg-gray-medium;
}

.nc-filter-wrapper {
  @apply bg-nc-bg-default !rounded-lg border-1px border-nc-border-gray-medium w-full;

  & > *,
  .nc-filter-field-input {
    @apply !border-none;
  }

  & > div > :deep(.ant-select-selector) {
    border: none !important;
    box-shadow: none !important;
  }

  & > :not(:last-child):not(:empty) {
    border-right: 1px solid var(--nc-border-gray-medium) !important;
    border-bottom-right-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }

  & > :not(:first-child) {
    border-bottom-left-radius: 0 !important;
    border-top-left-radius: 0 !important;
  }

  & > :last-child {
    @apply relative;
    &::after {
      content: '';
      @apply absolute h-full w-1px bg-nc-border-gray-medium -left-1px top-0;
    }
  }

  :deep(::placeholder) {
    @apply text-sm tracking-normal;
  }

  :deep(::-ms-input-placeholder) {
    @apply text-sm tracking-normal;
  }

  :deep(input) {
    @apply text-sm;
  }

  :deep(.nc-select:not(.ant-select-disabled):hover) {
    &,
    .ant-select-selector {
      @apply bg-nc-bg-gray-extralight;
    }
  }

  :deep(.nc-select) {
    .ant-select-disabled {
      border-radius: 0px !important;
    }
  }
}

.nc-filter-where-label {
  @apply text-nc-content-gray-disabled pl-3;
}

.nc-filter-item-remove-btn {
  @apply text-nc-content-gray-subtle2 hover:text-nc-content-gray;
}

.nc-filter-field-input {
  :deep(.tiptap) {
    @apply !border-none;
  }
}

:deep(.ant-select-selector) {
  @apply !min-h-8;
}
</style>
