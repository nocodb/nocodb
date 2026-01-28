<script setup lang="ts">
import type { EntitySelectorMode, FormBuilderEntitySelectorElement, FormBuilderSelectOption } from 'nocodb-sdk'

interface Props {
  element: FormBuilderEntitySelectorElement
  modelValue?: string | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { getFieldOptions, getIsLoadingFieldOptions, loadOptions } = useFormBuilderHelperOrThrow()

const workflowContext = inject(WorkflowVariableInj, null)

// Get modes from element config, default to list mode only
const modes = computed<EntitySelectorMode[]>(() => {
  if (props.element.modes && props.element.modes.length > 0) {
    return props.element.modes
  }
  // Default: list mode only
  return [{ type: 'list', placeholder: props.element.placeholder }]
})

// Current active mode
const currentModeIndex = ref(0)
const currentMode = computed(() => modes.value[currentModeIndex.value] || modes.value[0])

// Check if we have multiple modes
const hasMultipleModes = computed(() => modes.value.length > 1)

// Get list mode config (for fetching options)
const listModeConfig = computed(() => modes.value.find((m) => m.type === 'list'))

// Get options for dropdown mode
const listOptions = computed<FormBuilderSelectOption[]>(() => {
  if (!props.element.model || currentMode.value?.type !== 'list') return []
  return getFieldOptions(props.element.model) || []
})

const isLoadingOptions = computed(() => {
  if (!props.element.model) return false
  return getIsLoadingFieldOptions(props.element.model)
})

// Debounced search for server-side filtering
const debouncedSearch = useDebounceFn(async (query: string) => {
  if (currentMode.value?.type === 'list' && props.element.model && currentMode.value.searchable) {
    // Create element with fetchOptionsKey from current mode for loadOptions
    const elementWithFetchKey = {
      ...props.element,
      fetchOptionsKey: currentMode.value.fetchOptionsKey,
    }
    await loadOptions(elementWithFetchKey, query)
  }
}, 300)

function handleSearch(query: string) {
  if (currentMode.value?.searchable) {
    debouncedSearch(query)
  }
}

// Get workflow variables for manual input mode
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

// Check if value is a variable expression (contains $( or {{ )
function isVariableExpression(value: string | null | undefined): boolean {
  if (!value) return false
  return value.includes('$(') || value.includes('{{')
}

// Handle mode toggle
function toggleMode() {
  const newModeIndex = (currentModeIndex.value + 1) % modes.value.length
  const newMode = modes.value[newModeIndex]

  // When switching to list mode, clear value if it's a variable expression
  // or if it doesn't exist in the options
  if (newMode?.type === 'list' && vModel.value) {
    const isExpression = isVariableExpression(vModel.value)
    const existsInOptions = listOptions.value.some((opt) => opt.value === vModel.value)

    if (isExpression || !existsInOptions) {
      vModel.value = ''
    }
  }

  currentModeIndex.value = newModeIndex
}

// Handle list selection
function handleListSelect(selectedValue: string) {
  vModel.value = selectedValue
}

// Handle manual input change
function handleInputChange(newValue: string) {
  vModel.value = newValue
}

// Create element with fetchOptionsKey from list mode for loadOptions
function getElementWithFetchKey() {
  if (listModeConfig.value?.fetchOptionsKey) {
    return { ...props.element, fetchOptionsKey: listModeConfig.value.fetchOptionsKey }
  }
  return props.element
}

// Load options when component mounts (for dropdown mode)
onMounted(() => {
  if (currentMode.value?.type === 'list' && props.element.model && listModeConfig.value?.fetchOptionsKey) {
    loadOptions(getElementWithFetchKey())
  }
})

// Watch for mode changes to load options
watch(currentModeIndex, () => {
  if (currentMode.value?.type === 'list' && props.element.model && listModeConfig.value?.fetchOptionsKey) {
    loadOptions(getElementWithFetchKey())
  }
})
</script>

<template>
  <div class="nc-entity-selector">
    <div class="nc-entity-selector-container">
      <!-- Mode toggle button (only show if multiple modes) -->
      <NcTooltip v-if="hasMultipleModes" placement="top">
        <template #title>
          {{ currentMode?.type === 'list' ? 'Switch to expression input' : 'Switch to dropdown' }}
        </template>
        <NcButton type="text" size="small" class="nc-entity-selector-mode-toggle" :disabled="disabled" @click="toggleMode">
          <GeneralIcon :icon="currentMode?.type === 'list' ? 'ncList' : 'ncCode'" class="text-nc-content-gray-muted" />
        </NcButton>
      </NcTooltip>

      <!-- Input container -->
      <div class="nc-entity-selector-input-container">
        <!-- List mode (dropdown) -->
        <template v-if="currentMode?.type === 'list'">
          <a-select
            :value="vModel"
            :options="listOptions"
            :disabled="disabled"
            :loading="isLoadingOptions"
            :placeholder="currentMode.placeholder || element.placeholder || 'Select...'"
            class="nc-select flex-1 nc-select-shadow"
            show-search
            allow-clear
            :filter-option="currentMode.searchable ? false : (input: string, option: any) => option.label?.toLowerCase()?.includes(input.toLowerCase())"
            @change="handleListSelect"
            @search="handleSearch"
          >
            <template #suffixIcon>
              <GeneralIcon icon="ncChevronDown" class="text-nc-content-gray-muted" />
            </template>
          </a-select>
        </template>

        <!-- Manual mode (WorkflowInput) -->
        <template v-else>
          <NcFormBuilderInputWorkflowInput
            :model-value="vModel || ''"
            :placeholder="currentMode?.placeholder || element.placeholder || 'Enter value or expression...'"
            :variables="workflowVariables"
            :grouped-variables="groupedVariables"
            :read-only="disabled"
            class="flex-1"
            @update:model-value="handleInputChange"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-entity-selector {
  @apply w-full;

  .nc-entity-selector-container {
    @apply flex items-center gap-2;
  }

  .nc-entity-selector-mode-toggle {
    @apply flex-shrink-0;
  }

  .nc-entity-selector-input-container {
    @apply flex-1 flex items-center gap-1 min-w-0;

    :deep(.nc-workflow-input) {
      @apply min-w-0;

      .ProseMirror {
        @apply !h-8 !min-h-8 !py-1 !pr-8;
      }

      .nc-workflow-insert-btn-tooltip {
        @apply !top-0.5;
      }
    }

    :deep(.nc-select) {
      @apply min-w-0;
    }
  }
}
</style>
