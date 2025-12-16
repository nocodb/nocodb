<script setup lang="ts">
import { UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  modelValue: Record<string, any>
  columns: ColumnType[]
  meta: any
}

interface FieldInputMode {
  [fieldId: string]: 'static' | 'dynamic'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
}>()

const fieldInputModes = ref<FieldInputMode>({})
const settingsPanelOpen = ref<Record<string, boolean>>({})
const addedFieldIds = ref<Set<string>>(new Set())
const isFieldSelectorOpen = ref(false)

const workflowContext = inject(WorkflowVariableInj, null)

const { selectedNodeId } = useWorkflowOrThrow()

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const DYNAMIC_ONLY_FIELDS = [
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Attachment,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
]

const STATIC_AND_DYNAMIC_FIELDS = [
  UITypes.Checkbox,
  UITypes.MultiSelect,
  UITypes.SingleSelect,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.Year,
  UITypes.Time,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Rating,
  UITypes.GeoData,
  UITypes.JSON,
  UITypes.User,
]

const mockRow = computed(() => {
  // Transform fields from columnId keys to columnTitle keys for cell components
  const rowData: Record<string, any> = {}
  if (props.meta?.columnsById) {
    Object.entries(props.modelValue || {}).forEach(([fieldId, value]) => {
      const column = props.meta.columnsById[fieldId]
      if (column) {
        rowData[column.title] = value
      }
    })
  }
  return {
    row: rowData,
    oldRow: {},
    rowMeta: {
      new: true,
    },
  }
})

provide(
  MetaInj,
  computed(() => props.meta),
)
provide(IsFormInj, ref(true))
provide(IsExpandedFormOpenInj, ref(true))

useProvideSmartsheetLtarHelpers(computed(() => props.meta))
useProvideSmartsheetRowStore(mockRow, ref(new Set<string>()))

const isDynamicOnly = (col: ColumnType) => {
  return DYNAMIC_ONLY_FIELDS.includes(col.uidt as UITypes)
}

const supportsBothModes = (col: ColumnType) => {
  return STATIC_AND_DYNAMIC_FIELDS.includes(col.uidt as UITypes)
}

const getFieldMode = (col: ColumnType) => {
  if (isDynamicOnly(col)) return 'dynamic'
  return fieldInputModes.value[col.id] || 'static'
}

const toggleFieldMode = (fieldId: string, mode: 'static' | 'dynamic') => {
  fieldInputModes.value[fieldId] = mode
  settingsPanelOpen.value[fieldId] = false
  // Clear the field value when switching modes to avoid conflicts
  const updatedFields = { ...props.modelValue }
  updatedFields[fieldId] = null
  emit('update:modelValue', updatedFields)
}

const toggleSettingsPanel = (fieldId: string) => {
  settingsPanelOpen.value[fieldId] = !settingsPanelOpen.value[fieldId]
}

const updateFieldValue = (fieldId: string, value: any) => {
  const updatedFields = { ...props.modelValue }
  updatedFields[fieldId] = value
  emit('update:modelValue', updatedFields)
}

const addField = (col: ColumnType) => {
  addedFieldIds.value.add(col.id)
  // Set default mode for the field
  if (isDynamicOnly(col)) {
    fieldInputModes.value[col.id] = 'dynamic'
  } else {
    fieldInputModes.value[col.id] = 'static'
  }
  isFieldSelectorOpen.value = false
}

const removeField = (fieldId: string) => {
  addedFieldIds.value.delete(fieldId)
  delete fieldInputModes.value[fieldId]
  delete settingsPanelOpen.value[fieldId]
  const updatedFields = { ...props.modelValue }
  delete updatedFields[fieldId]
  emit('update:modelValue', updatedFields)
}

const editableColumns = computed(() => {
  return props.columns.filter((col) => !isSystemColumn(col) && !isVirtualCol(col))
})

const addedFields = computed(() => {
  return editableColumns.value.filter((col) => addedFieldIds.value.has(col.id))
})

const availableFields = computed(() => {
  return editableColumns.value.filter((col) => !addedFieldIds.value.has(col.id))
})

const isDynamicValue = (value: any): boolean => {
  if (typeof value !== 'string') return false
  return /\{[^}]+\}/.test(value)
}

const initializeFieldModes = () => {
  if (!props.modelValue) return

  // Only initialize if addedFieldIds is empty (on mount or table change)
  if (addedFieldIds.value.size === 0) {
    Object.entries(props.modelValue).forEach(([fieldId, value]) => {
      addedFieldIds.value.add(fieldId)
      if (isDynamicValue(value)) {
        fieldInputModes.value[fieldId] = 'dynamic'
      }
    })
  } else {
    // Just update field modes for existing fields
    Object.entries(props.modelValue).forEach(([fieldId, value]) => {
      if (isDynamicValue(value)) {
        fieldInputModes.value[fieldId] = 'dynamic'
      }
    })
  }
}

watch(
  () => props.modelValue,
  () => {
    initializeFieldModes()
  },
  { immediate: true, deep: true },
)

watch(
  () => props.columns,
  () => {
    // Reset when columns change
    addedFieldIds.value.clear()
    fieldInputModes.value = {}
    initializeFieldModes()
  },
  { immediate: true },
)
</script>

<template>
  <div class="workflow-field-list flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <label class="text-sm font-semibold text-nc-content-gray-emphasis">Fields</label>
      <NcDropdown v-model:visible="isFieldSelectorOpen">
        <NcButton size="xs" type="secondary">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" />
            <span>Add Field</span>
          </div>
        </NcButton>
        <template #overlay>
          <NcMenu class="max-h-96 overflow-auto nc-scrollbar-thin">
            <template v-if="availableFields.length > 0">
              <NcMenuItem v-for="col in availableFields" :key="col.id" @click="addField(col)">
                <div class="flex items-center gap-2">
                  <SmartsheetHeaderIcon :column="col" />
                  <span>{{ col.title }}</span>
                </div>
              </NcMenuItem>
            </template>
            <div v-else class="px-3 py-2 text-sm text-nc-content-gray-muted">All fields have been added</div>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
    <div v-if="addedFields.length > 0" class="flex flex-col gap-3">
      <div v-for="col in addedFields" :key="col.id" class="field-item flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <SmartsheetHeaderIcon :column="col" class="text-nc-content-gray-muted" />
          <span class="text-sm text-nc-content-gray-emphasis flex-1">{{ col.title }}</span>
          <NcDropdown v-if="supportsBothModes(col)" :visible="settingsPanelOpen[col.id]">
            <NcButton size="xs" type="text" class="!px-1.5" @click.stop="toggleSettingsPanel(col.id)">
              <GeneralIcon icon="settings" class="text-nc-content-gray-subtle w-4 h-4" />
            </NcButton>
            <template #overlay>
              <NcMenu>
                <NcMenuItem class="relative" @click="toggleFieldMode(col.id, 'static')">
                  <div class="flex-1">
                    <div class="text-sm font-medium text-nc-content-gray-emphasis">Static</div>
                    <div class="text-xs text-nc-content-gray-muted mt-0.5">Enter values directly</div>
                  </div>
                  <GeneralIcon
                    v-if="getFieldMode(col) === 'static'"
                    icon="check"
                    class="flex-none w-4 h-4 text-nc-content-brand mt-0.5 absolute right-2 top-2"
                  />
                </NcMenuItem>
                <NcMenuItem class="relative" @click="toggleFieldMode(col.id, 'dynamic')">
                  <div class="flex-1">
                    <div class="text-sm font-medium text-nc-content-gray-emphasis">Dynamic</div>
                    <div class="text-xs text-nc-content-gray-muted mt-0.5">
                      Use variables from a previous step of this automation
                    </div>
                  </div>
                  <GeneralIcon
                    v-if="getFieldMode(col) === 'dynamic'"
                    icon="check"
                    class="flex-none w-4 h-4 text-nc-content-brand mt-0.5 absolute right-2 top-2"
                  />
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
          <NcButton size="xs" type="text" class="!px-1.5" @click="removeField(col.id)">
            <GeneralIcon icon="close" class="text-nc-content-gray-subtle w-4 h-4" />
          </NcButton>
        </div>
        <div class="field-input">
          <NcFormBuilderInputWorkflowInput
            v-if="getFieldMode(col) === 'dynamic'"
            :model-value="modelValue[col.id]"
            :variables="flatVariables"
            :grouped-variables="groupedVariables"
            :placeholder="`Enter ${col.title}`"
            @update:model-value="updateFieldValue(col.id, $event)"
          />
          <SmartsheetDivDataCell v-else class="nc-workflow-static-cell" :data-uidt="col.uidt">
            <LazySmartsheetCell
              v-model="mockRow.row[col.title]"
              :column="col"
              :edit-enabled="true"
              :active="true"
              @update:model-value="updateFieldValue(col.id, $event)"
            />
          </SmartsheetDivDataCell>
        </div>
      </div>
    </div>
    <div v-else class="text-sm text-nc-content-gray-muted text-center py-4">Click "Add Field" to add fields to this record</div>
  </div>
</template>

<style scoped lang="scss">
.workflow-field-list {
  .field-item {
    @apply relative;
  }

  .field-input {
    @apply w-full;
  }

  .nc-workflow-static-cell {
    @apply bg-nc-bg-default h-8 flex items-center relative;

    &:focus-within {
      @apply !shadow-selected;
    }

    :deep(.nc-cell-number) {
      @apply !px-2;
    }

    :deep(.nc-cell-multiselect),
    :deep(.nc-user-select),
    :deep(.nc-cell-singleselect) {
      @apply !pl-2;
    }

    :deep(.nc-cell-geometry),
    :deep(.nc-cell-rating) {
      @apply h-auto;
    }

    :deep(.nc-cell-date),
    :deep(.nc-cell-datetime),
    :deep(.nc-cell-year),
    :deep(.nc-cell-duration),
    :deep(.nc-cell-time),
    :deep(.nc-cell-percent),
    :deep(.nc-cell-geodata),
    :deep(.nc-cell-json),
    :deep(.nc-cell-decimal) {
      @apply !px-2 h-auto;
    }

    :deep(.nc-cell) {
      @apply w-full;
    }
  }
}
</style>
