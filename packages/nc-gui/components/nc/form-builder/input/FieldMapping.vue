<script setup lang="ts">
import type { FormBuilderFieldMappingElement, FormBuilderSelectOption } from 'nocodb-sdk'

interface Props {
  element: FormBuilderFieldMappingElement
  modelValue?: Record<string, string> | null
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

interface FieldRow {
  id: string
  fieldId: string
  value: string
}

const fieldRows = ref<FieldRow[]>([])
const isInitializing = ref(false)

const { getFieldOptions } = useFormBuilderHelperOrThrow()

const workflowContext = inject(WorkflowVariableInj, null)

const fieldOptions = computed<FormBuilderSelectOption[]>(() => {
  if (!props.element.model) return []
  return getFieldOptions(props.element.model) || []
})

const flatVariables = computed(() => {
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

const initializeFieldRows = () => {
  isInitializing.value = true
  if (vModel.value && typeof vModel.value === 'object') {
    fieldRows.value = Object.entries(vModel.value).map(([fieldId, value], index) => ({
      id: `${index}-${fieldId}`,
      fieldId,
      value: value || '',
    }))
  } else if (fieldRows.value.length === 0) {
    fieldRows.value.push({
      id: `${Date.now()}-${Math.random()}`,
      fieldId: '',
      value: '',
    })
  }
  nextTick(() => {
    isInitializing.value = false
  })
}

onMounted(() => {
  initializeFieldRows()
})

watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    if (!isInitializing.value && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      initializeFieldRows()
    }
  },
)

watch(
  fieldRows,
  (rows) => {
    if (isInitializing.value) return

    const newValue: Record<string, string> = {}
    rows.forEach((row) => {
      if (row.fieldId) {
        newValue[row.fieldId] = row.value
      }
    })
    vModel.value = Object.keys(newValue).length > 0 ? newValue : null
  },
  { deep: true },
)

function addFieldRow() {
  fieldRows.value.push({
    id: `${Date.now()}-${Math.random()}`,
    fieldId: '',
    value: '',
  })
}

function removeFieldRow(index: number) {
  fieldRows.value.splice(index, 1)

  if (fieldRows.value.length === 0) {
    addFieldRow()
  }
}

function getAvailableOptions(currentRowId: string) {
  const selectedFieldIds = new Set(
    fieldRows.value.filter((row) => row.id !== currentRowId && row.fieldId).map((row) => row.fieldId),
  )

  return fieldOptions.value.filter((option) => !selectedFieldIds.has(option.value))
}
</script>

<template>
  <div class="flex flex-col gap-2 w-full nc-field-mapping">
    <div v-for="(row, index) in fieldRows" :key="row.id" class="nc-field-mapping-row">
      <div class="nc-field-mapping-content">
        <a-select
          v-model:value="row.fieldId"
          class="nc-select flex-1 w-full nc-select-shadow"
          :placeholder="$t('placeholder.selectField')"
          show-search
          :filter-option="
            (input: string, option: any) => {
              return option.label?.toLowerCase()?.includes(input.toLowerCase())
            }
          "
        >
          <template #suffixIcon>
            <GeneralIcon class="text-nc-content-gray nc-select-expand-btn" icon="ncChevronDown" />
          </template>

          <a-select-option
            v-for="option in getAvailableOptions(row.id)"
            :key="option.value"
            :value="option.value"
            :label="option.label"
            :disabled="option.ncItemDisabled"
          >
            <div class="flex items-center">
              <NcTooltip class="flex-1" :disabled="!option.ncItemTooltip">
                <template #title>
                  {{ option.ncItemTooltip }}
                </template>
                <div class="flex items-center gap-2">
                  <span>{{ option.label }}</span>
                </div>
              </NcTooltip>

              <GeneralIcon
                v-if="row.fieldId === option.value"
                id="nc-selected-item-icon"
                class="text-nc-content-brand"
                icon="check"
              />
            </div>
          </a-select-option>
        </a-select>

        <NcFormBuilderInputWorkflowInput
          class="flex-1 w-full"
          :grouped-variables="groupedVariables"
          :variables="flatVariables"
          :model-value="row.value"
          @update:model-value="row.value = $event"
        />
        <NcButton type="text" size="small" @click="removeFieldRow(index)">
          <GeneralIcon icon="delete" class="text-nc-content-gray-muted" />
        </NcButton>
      </div>
    </div>

    <NcButton class="nc-field-mapping-add-btn" type="text" size="small" @click="addFieldRow">
      <div class="flex items-center gap-1">
        <GeneralIcon icon="plus" />
        <span> Add new field </span>
      </div>
    </NcButton>
  </div>
</template>

<style scoped lang="scss">
.nc-field-mapping {
  :deep(.nc-workflow-input) {
    .ProseMirror {
      @apply !h-8 !min-h-8 !py-1;
    }

    .nc-workflow-input-insert-btn {
      @apply !-top-0.5;
    }
  }

  .nc-field-mapping-row {
    @apply flex items-start gap-2;

    .nc-field-mapping-content {
      @apply flex items-start gap-2 flex-1;
    }
  }

  .nc-field-mapping-add-btn {
    @apply self-start;
  }
}
</style>
