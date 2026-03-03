<script setup lang="ts">
import type {
  ConditionBuilderValue,
  FilterCombinator,
  FilterConditionValue,
  FilterDataType,
  FilterOperator,
  FilterOperatorType,
  FormBuilderConditionBuilderElement,
} from 'nocodb-sdk'

interface Props {
  element: FormBuilderConditionBuilderElement
  modelValue?: ConditionBuilderValue | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const workflowContext = inject(WorkflowVariableInj, null)

const { getFieldOptions, getIsLoadingFieldOptions, loadOptions } = useFormBuilderHelperOrThrow()

// Dropdown state
const isDropdownOpen = ref(false)

// Track property input mode per condition: 'select' or 'manual'
const propertyInputMode = ref<Record<string, 'select' | 'manual'>>({})

// Define all available operators
const ALL_OPERATORS: FilterOperator[] = [
  // String operators
  { id: 'string:equals', name: 'equals', type: 'string', operation: 'equals' },
  { id: 'string:notEquals', name: 'not equals', type: 'string', operation: 'notEquals' },
  { id: 'string:contains', name: 'contains', type: 'string', operation: 'contains' },
  { id: 'string:notContains', name: 'does not contain', type: 'string', operation: 'notContains' },
  { id: 'string:startsWith', name: 'starts with', type: 'string', operation: 'startsWith' },
  { id: 'string:endsWith', name: 'ends with', type: 'string', operation: 'endsWith' },
  { id: 'string:regex', name: 'matches regex', type: 'string', operation: 'regex' },
  { id: 'string:exists', name: 'exists', type: 'string', operation: 'exists', singleValue: true },
  { id: 'string:notExists', name: 'does not exist', type: 'string', operation: 'notExists', singleValue: true },
  { id: 'string:empty', name: 'is empty', type: 'string', operation: 'empty', singleValue: true },
  { id: 'string:notEmpty', name: 'is not empty', type: 'string', operation: 'notEmpty', singleValue: true },

  // Number operators
  { id: 'number:equals', name: 'equals', type: 'number', operation: 'equals' },
  { id: 'number:notEquals', name: 'not equals', type: 'number', operation: 'notEquals' },
  { id: 'number:gt', name: 'greater than', type: 'number', operation: 'gt' },
  { id: 'number:gte', name: 'greater than or equal', type: 'number', operation: 'gte' },
  { id: 'number:lt', name: 'less than', type: 'number', operation: 'lt' },
  { id: 'number:lte', name: 'less than or equal', type: 'number', operation: 'lte' },
  { id: 'number:exists', name: 'exists', type: 'number', operation: 'exists', singleValue: true },
  { id: 'number:notExists', name: 'does not exist', type: 'number', operation: 'notExists', singleValue: true },
  { id: 'number:empty', name: 'is empty', type: 'number', operation: 'empty', singleValue: true },
  { id: 'number:notEmpty', name: 'is not empty', type: 'number', operation: 'notEmpty', singleValue: true },

  // DateTime operators
  { id: 'dateTime:equals', name: 'equals', type: 'dateTime', operation: 'equals' },
  { id: 'dateTime:notEquals', name: 'not equals', type: 'dateTime', operation: 'notEquals' },
  { id: 'dateTime:after', name: 'after', type: 'dateTime', operation: 'after' },
  { id: 'dateTime:before', name: 'before', type: 'dateTime', operation: 'before' },
  { id: 'dateTime:exists', name: 'exists', type: 'dateTime', operation: 'exists', singleValue: true },
  { id: 'dateTime:notExists', name: 'does not exist', type: 'dateTime', operation: 'notExists', singleValue: true },
  { id: 'dateTime:empty', name: 'is empty', type: 'dateTime', operation: 'empty', singleValue: true },
  { id: 'dateTime:notEmpty', name: 'is not empty', type: 'dateTime', operation: 'notEmpty', singleValue: true },

  // Boolean operators
  { id: 'boolean:isTrue', name: 'is true', type: 'boolean', operation: 'isTrue', singleValue: true },
  { id: 'boolean:isFalse', name: 'is false', type: 'boolean', operation: 'isFalse', singleValue: true },
  { id: 'boolean:exists', name: 'exists', type: 'boolean', operation: 'exists', singleValue: true },
  { id: 'boolean:notExists', name: 'does not exist', type: 'boolean', operation: 'notExists', singleValue: true },

  // Any type operators
  { id: 'any:equals', name: 'equals', type: 'any', operation: 'equals' },
  { id: 'any:notEquals', name: 'not equals', type: 'any', operation: 'notEquals' },
  { id: 'any:exists', name: 'exists', type: 'any', operation: 'exists', singleValue: true },
  { id: 'any:notExists', name: 'does not exist', type: 'any', operation: 'notExists', singleValue: true },
  { id: 'any:empty', name: 'is empty', type: 'any', operation: 'empty', singleValue: true },
  { id: 'any:notEmpty', name: 'is not empty', type: 'any', operation: 'notEmpty', singleValue: true },
]

// Default operator by type
const DEFAULT_OPERATOR_BY_TYPE: Record<FilterDataType, string> = {
  string: 'string:equals',
  number: 'number:equals',
  boolean: 'boolean:isTrue',
  dateTime: 'dateTime:equals',
  array: 'any:exists',
  object: 'any:exists',
  any: 'any:equals',
}

// Get available operators based on element configuration
const availableOperators = computed(() => {
  let operators = ALL_OPERATORS

  // Filter by allowed types
  if (props.element.allowedTypes?.length) {
    operators = operators.filter((op) => props.element.allowedTypes!.includes(op.type) || op.type === 'any')
  }

  // Filter by supported operators
  if (props.element.supportedOperators?.length) {
    operators = operators.filter((op) => props.element.supportedOperators!.includes(op.operation))
  }

  return operators
})

// Group operators by type for dropdown
const operatorsByType = computed(() => {
  const grouped: Record<string, FilterOperator[]> = {}
  availableOperators.value.forEach((op) => {
    if (!grouped[op.type]) {
      grouped[op.type] = []
    }
    grouped[op.type].push(op)
  })
  return grouped
})

// Get operator by ID
function getOperator(type: FilterDataType, operation: FilterOperatorType): FilterOperator | undefined {
  return availableOperators.value.find((op) => op.type === type && op.operation === operation)
}

// Initialize conditions
const conditions = ref<FilterConditionValue[]>([])
const combinator = ref<FilterCombinator>('and')

// Track internal updates
const isInternalUpdate = ref(false)

// Initialize from modelValue
function initializeConditions() {
  if (!vModel.value) {
    conditions.value = []
    combinator.value = 'and'
    return
  }

  combinator.value = vModel.value.combinator || 'and'
  conditions.value = (vModel.value.conditions || []).map((c) => ({
    ...c,
    id: c.id || generateRandomUUID(),
  }))
}

// Watch for external changes
watch(
  () => props.modelValue,
  () => {
    if (isInternalUpdate.value) return
    initializeConditions()
  },
  { immediate: true, deep: true },
)

// Sync back to modelValue
watch(
  [conditions, combinator],
  () => {
    isInternalUpdate.value = true
    vModel.value = {
      combinator: combinator.value,
      conditions: conditions.value,
    }
    nextTick(() => {
      isInternalUpdate.value = false
    })
  },
  { deep: true },
)

// Get workflow variables
const workflowVariables = computed(() => {
  if (!workflowContext?.selectedNodeId?.value || !workflowContext?.getAvailableVariablesFlat) {
    return []
  }
  return workflowContext.getAvailableVariablesFlat(workflowContext.selectedNodeId.value)
})

const groupedVariables = computed(() => {
  if (!workflowContext?.selectedNodeId?.value || !workflowContext?.getAvailableVariables) {
    return []
  }
  return workflowContext.getAvailableVariables(workflowContext.selectedNodeId.value)
})

// Add new condition
function addCondition() {
  if (props.element.maxConditions && conditions.value.length >= props.element.maxConditions) {
    return
  }

  const defaultType = props.element.allowedTypes?.[0] || 'string'
  const defaultOperatorId = DEFAULT_OPERATOR_BY_TYPE[defaultType]
  const defaultOperator = availableOperators.value.find((op) => op.id === defaultOperatorId) || availableOperators.value[0]

  conditions.value.push({
    id: generateRandomUUID(),
    leftValue: '',
    operator: {
      type: defaultOperator?.type || 'string',
      operation: defaultOperator?.operation || 'equals',
    },
    rightValue: '',
  })
}

// Remove condition
function removeCondition(index: number) {
  conditions.value.splice(index, 1)
}

// Update condition
function updateCondition(index: number, field: keyof FilterConditionValue, value: unknown) {
  if (field === 'operator' && typeof value === 'string') {
    // Parse operator ID (e.g., 'string:equals')
    const [type, operation] = value.split(':') as [FilterDataType, FilterOperatorType]
    conditions.value[index].operator = { type, operation }
  } else {
    ;(conditions.value[index] as Record<string, unknown>)[field] = value
  }
}

// Get operator select options
const operatorOptions = computed(() => {
  const options: Array<{ label: string; value: string; group?: string }> = []

  Object.entries(operatorsByType.value).forEach(([type, ops]) => {
    ops.forEach((op) => {
      options.push({
        label: op.name,
        value: op.id,
        group: type,
      })
    })
  })

  return options
})

// Check if operator is single-value (no right side needed)
function isSingleValueOperator(condition: FilterConditionValue): boolean {
  const operator = getOperator(condition.operator.type, condition.operator.operation)
  return operator?.singleValue || false
}

// Can add more conditions
const canAddCondition = computed(() => {
  if (props.disabled) return false
  return !(props.element.maxConditions && conditions.value.length >= props.element.maxConditions)
})

// Property options support
const hasPropertyOptions = computed(() => {
  return !!(props.element.propertyOptions?.length || props.element.fetchPropertyOptionsKey)
})

// Get property options (static or fetched)
const propertyOptions = computed(() => {
  // Static options from element config
  if (props.element.propertyOptions?.length) {
    return props.element.propertyOptions
  }
  // Fetched options
  if (props.element.fetchPropertyOptionsKey && props.element.model) {
    return getFieldOptions(`${props.element.model}_properties`) || []
  }
  return []
})

const isLoadingPropertyOptions = computed(() => {
  if (!props.element.fetchPropertyOptionsKey || !props.element.model) return false
  return getIsLoadingFieldOptions(`${props.element.model}_properties`)
})

// Get input mode for a condition
function getPropertyInputMode(conditionId: string): 'select' | 'manual' {
  return propertyInputMode.value[conditionId] || (hasPropertyOptions.value ? 'select' : 'manual')
}

// Toggle property input mode for a condition
function togglePropertyInputMode(conditionId: string) {
  const current = getPropertyInputMode(conditionId)
  propertyInputMode.value[conditionId] = current === 'select' ? 'manual' : 'select'
}

// Load property options if fetchPropertyOptionsKey is set
async function loadPropertyOptions() {
  if (props.element.fetchPropertyOptionsKey && props.element.model) {
    const elementForFetch = {
      ...props.element,
      model: `${props.element.model}_properties`,
      fetchOptionsKey: props.element.fetchPropertyOptionsKey,
    }
    await loadOptions(elementForFetch as any)
  }
}

// Load options on mount
onMounted(() => {
  loadPropertyOptions()
})
</script>

<template>
  <div class="nc-condition-builder">
    <NcListDropdown
      v-model:visible="isDropdownOpen"
      :disabled="disabled"
      placement="bottomLeft"
      overlay-class-name="nc-condition-builder-dropdown"
    >
      <!-- Trigger: Compact condition count display -->
      <div
        class="nc-conditions-count flex-1"
        :class="{
          'text-nc-content-brand': conditions.length > 0,
          'text-nc-content-gray-muted': conditions.length === 0,
        }"
      >
        {{ conditions.length > 0 ? `${conditions.length} condition${conditions.length !== 1 ? 's' : ''}` : 'No conditions' }}
      </div>
      <GeneralIcon
        icon="ncChevronDown"
        class="flex-none w-4 h-4"
        :class="{
          'text-nc-content-brand': conditions.length > 0,
          'text-nc-content-gray-muted': conditions.length === 0,
        }"
      />

      <!-- Dropdown overlay: Full condition builder -->
      <template #overlay>
        <div class="nc-condition-builder-dropdown-container">
          <!-- Empty state -->
          <div v-if="conditions.length === 0" class="p-4">
            <NcButton type="text" size="small" :disabled="disabled" @click="addCondition">
              <template #icon>
                <GeneralIcon icon="ncPlus" class="w-4 h-4" />
              </template>
              Add condition
            </NcButton>
            <div class="text-nc-content-gray-muted mt-2 ml-0.5">No conditions added</div>
          </div>

          <!-- Conditions list -->
          <div v-else class="p-3">
            <div class="space-y-1.5 mb-3">
              <template v-for="(condition, index) in conditions" :key="condition.id">
                <!-- Single connected row like If node -->
                <div class="flex flex-nowrap gap-0 nc-filter-wrapper">
                  <!-- Where / AND / OR -->
                  <div v-if="index === 0" class="flex items-center !min-w-18 !max-w-18 nc-filter-where-label">Where</div>
                  <NcSelect
                    v-else
                    :value="combinator"
                    :disabled="index !== 1"
                    class="h-full !max-w-18 !min-w-18 capitalize"
                    dropdown-class-name="nc-dropdown-filter-logical-op"
                    @update:value="combinator = $event"
                  >
                    <a-select-option value="and">
                      <div class="flex items-center justify-between gap-2">
                        <span class="capitalize">And</span>
                        <GeneralIcon
                          v-if="combinator === 'and'"
                          id="nc-selected-item-icon"
                          icon="ncCheck"
                          class="text-primary w-4 h-4"
                        />
                      </div>
                    </a-select-option>
                    <a-select-option value="or">
                      <div class="flex items-center justify-between gap-2">
                        <span class="capitalize">Or</span>
                        <GeneralIcon
                          v-if="combinator === 'or'"
                          id="nc-selected-item-icon"
                          icon="ncCheck"
                          class="text-primary w-4 h-4"
                        />
                      </div>
                    </a-select-option>
                  </NcSelect>

                  <!-- Field Input -->
                  <div v-if="!element.fixedLeftValue" class="nc-filter-field-input min-w-36 max-w-36 flex items-center">
                    <template v-if="hasPropertyOptions && getPropertyInputMode(condition.id) === 'select'">
                      <NcButton
                        type="text"
                        size="xs"
                        class="nc-property-mode-toggle flex-shrink-0 ml-1"
                        :disabled="disabled"
                        @click="togglePropertyInputMode(condition.id)"
                      >
                        <GeneralIcon icon="ncList" class="text-nc-content-gray-muted w-3.5 h-3.5" />
                      </NcButton>
                      <NcSelect
                        :value="condition.leftValue || undefined"
                        :disabled="disabled"
                        :loading="isLoadingPropertyOptions"
                        :placeholder="element.propertyPlaceholder || 'Property'"
                        class="nc-property-select flex-1"
                        dropdown-class-name="nc-dropdown-filter-property"
                        show-search
                        allow-clear
                        :filter-option="(input: string, option: any) => option.label?.toLowerCase()?.includes(input.toLowerCase())"
                        @update:value="updateCondition(index, 'leftValue', $event || '')"
                      >
                        <a-select-option v-for="opt in propertyOptions" :key="opt.value" :value="opt.value">
                          <div class="flex items-center justify-between gap-2">
                            <span class="truncate">{{ opt.label }}</span>
                            <GeneralIcon
                              v-if="condition.leftValue === opt.value"
                              id="nc-selected-item-icon"
                              icon="ncCheck"
                              class="text-primary w-4 h-4 flex-shrink-0"
                            />
                          </div>
                        </a-select-option>
                      </NcSelect>
                    </template>

                    <!-- Manual mode (WorkflowInput) -->
                    <template v-else>
                      <!-- Mode toggle button (only show if hasPropertyOptions) -->
                      <NcButton
                        v-if="hasPropertyOptions"
                        type="text"
                        size="xs"
                        class="nc-property-mode-toggle flex-shrink-0 ml-1"
                        :disabled="disabled"
                        @click="togglePropertyInputMode(condition.id)"
                      >
                        <GeneralIcon icon="ncCode" class="text-nc-content-gray-muted w-3.5 h-3.5" />
                      </NcButton>
                      <NcFormBuilderInputWorkflowInput
                        :model-value="condition.leftValue || ''"
                        :placeholder="element.propertyPlaceholder || 'Property'"
                        :variables="workflowVariables"
                        :grouped-variables="groupedVariables"
                        :read-only="disabled"
                        class="nc-property-input flex-1 h-8"
                        @update:model-value="updateCondition(index, 'leftValue', $event)"
                      />
                    </template>
                  </div>

                  <!-- Operator -->
                  <NcSelect
                    :value="`${condition.operator.type}:${condition.operator.operation}`"
                    :options="operatorOptions"
                    :disabled="disabled"
                    class="nc-filter-comparison-op !min-w-26.75"
                    dropdown-class-name="nc-dropdown-filter-comp-op"
                    @update:value="updateCondition(index, 'operator', $event)"
                  />

                  <!-- Value Input (if needed) -->
                  <div
                    v-if="!isSingleValueOperator(condition)"
                    class="nc-filter-value-input flex items-center flex-grow min-w-34"
                  >
                    <NcFormBuilderInputWorkflowInput
                      :model-value="condition.rightValue || ''"
                      placeholder="Enter value"
                      :variables="workflowVariables"
                      :grouped-variables="groupedVariables"
                      :read-only="disabled"
                      class="nc-value-input flex-1 h-8"
                      @update:model-value="updateCondition(index, 'rightValue', $event)"
                    />
                  </div>
                  <div v-else class="flex-grow"></div>

                  <!-- Remove Button -->
                  <NcButton
                    v-if="!disabled"
                    type="text"
                    size="small"
                    class="nc-filter-item-remove-btn self-center"
                    @click="removeCondition(index)"
                  >
                    <GeneralIcon icon="deleteListItem" />
                  </NcButton>
                </div>
              </template>
            </div>

            <!-- Add condition button -->
            <div v-if="canAddCondition" class="nc-condition-builder-add">
              <NcButton type="text" size="small" :disabled="disabled" @click="addCondition">
                <template #icon>
                  <GeneralIcon icon="ncPlus" class="w-4 h-4" />
                </template>
                Add condition
              </NcButton>
            </div>
          </div>
        </div>
      </template>
    </NcListDropdown>
  </div>
</template>

<style lang="scss">
.nc-condition-builder-dropdown {
  @apply !min-w-[560px] !max-w-[700px];

  .ant-dropdown-menu {
    @apply !p-0;
  }
}

.nc-dropdown-filter-property {
  @apply !min-w-[180px];
}
</style>

<style scoped lang="scss">
.nc-condition-builder {
  @apply w-full;

  .nc-condition-builder-dropdown-container {
    @apply max-h-[400px] overflow-y-auto;
  }

  .nc-condition-builder-add {
    @apply self-start;
  }
}

.nc-filter-wrapper {
  @apply bg-nc-bg-default !rounded-lg border-1px border-nc-border-gray-medium w-full items-center;

  & > *,
  .nc-filter-field-input {
    @apply !border-none;
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

  :deep(.nc-select),
  :deep(.nc-select.ant-select) {
    .ant-select-selector {
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    .ant-select-disabled {
      border-radius: 0 !important;
    }

    // Hide search icon when using show-search
    &.ant-select-show-search .ant-select-selector .ant-select-selection-search-input {
      @apply !h-full;
    }
  }

  :deep(.ant-select-selector) {
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }

  :deep(.ant-input) {
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
}

.nc-filter-where-label {
  @apply text-nc-content-gray-disabled pl-3;
}

.nc-filter-item-remove-btn {
  @apply text-nc-content-gray-subtle2 hover:text-nc-content-gray;
}

.nc-filter-field-input {
  .nc-property-mode-toggle {
    @apply flex-shrink-0 !border-r-1;
  }

  :deep(.nc-select),
  :deep(.nc-select.ant-select) {
    @apply h-8;

    .ant-select-selector {
      @apply !h-8 !min-h-8;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    .ant-select-arrow {
      @apply text-nc-content-gray-muted;
    }

    .ant-select-clear {
      @apply bg-nc-bg-default;
    }
  }

  :deep(.nc-workflow-input) {
    .ProseMirror {
      @apply !h-8 !min-h-8 border-none !py-1;
    }
  }
}

.nc-filter-value-input {
  :deep(.nc-workflow-input) {
    .ProseMirror {
      @apply !h-8 !min-h-8 border-none !py-1 !pr-8;
    }

    .nc-workflow-input-insert-btn {
      @apply !-top-0.5;
    }
  }
}

:deep(.nc-workflow-input) {
  .ProseMirror {
    @apply !h-8 !min-h-8 border-none !py-1;
  }

  .nc-workflow-input-insert-btn {
    @apply !-top-0.5;
  }
}

:deep(.ant-select-selector) {
  @apply !min-h-8;
}
</style>
