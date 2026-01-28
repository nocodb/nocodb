<script setup lang="ts">
import type { FormBuilderKeyValueElement } from 'nocodb-sdk'

interface Props {
  element: FormBuilderKeyValueElement
  modelValue?: Record<string, string> | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const workflowContext = inject(WorkflowVariableInj, null)

interface KeyValueRow {
  id: string
  key: string
  value: string
}

const isInternalUpdate = ref(false)

// Get workflow variables for expression input
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

const rows = ref<KeyValueRow[]>(
  props.modelValue && typeof props.modelValue === 'object'
    ? Object.entries(props.modelValue).map(([key, value]) => ({
        id: generateRandomUUID(),
        key,
        value: value || '',
      }))
    : [
        {
          id: generateRandomUUID(),
          key: '',
          value: '',
        },
      ],
)

watch(
  rows,
  (newRows) => {
    const newValue: Record<string, string> = {}
    newRows.forEach((row) => {
      if (row.key) {
        newValue[row.key] = row.value
      }
    })
    isInternalUpdate.value = true
    vModel.value = Object.keys(newValue).length > 0 ? newValue : null
    nextTick(() => {
      isInternalUpdate.value = false
    })
  },
  { deep: true },
)

function addRow() {
  rows.value.push({
    id: generateRandomUUID(),
    key: '',
    value: '',
  })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)

  if (rows.value.length === 0) {
    addRow()
  }
}

// Watch modelValue for external changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (isInternalUpdate.value) return

    if (!newValue || (typeof newValue === 'object' && Object.keys(newValue).length === 0)) {
      rows.value = [
        {
          id: generateRandomUUID(),
          key: '',
          value: '',
        },
      ]
    } else if (typeof newValue === 'object') {
      rows.value = Object.entries(newValue).map(([key, value]) => ({
        id: generateRandomUUID(),
        key,
        value: value || '',
      }))
    }
  },
)
</script>

<template>
  <div class="nc-key-value flex flex-col gap-2 w-full">
    <div v-for="(row, index) in rows" :key="row.id" class="nc-key-value-row">
      <div class="nc-key-value-content">
        <a-input v-model:value="row.key" class="flex-1 w-full" :placeholder="element.keyLabel || 'Key'" :disabled="disabled" />

        <NcFormBuilderInputWorkflowInput
          v-model="row.value"
          class="flex-1 w-full"
          :placeholder="element.valueLabel || 'Value'"
          :variables="workflowVariables"
          :grouped-variables="groupedVariables"
          :read-only="disabled"
        />

        <NcButton type="text" size="small" :disabled="disabled" @click="removeRow(index)">
          <GeneralIcon icon="delete" class="text-nc-content-gray-muted" />
        </NcButton>
      </div>
    </div>

    <NcButton class="nc-key-value-add-btn self-start" type="text" size="small" :disabled="disabled" @click="addRow">
      <div class="flex items-center gap-1">
        <GeneralIcon icon="plus" />
        <span>{{ element.placeholder || 'Add row' }}</span>
      </div>
    </NcButton>
  </div>
</template>

<style scoped lang="scss">
.nc-key-value {
  :deep(.nc-workflow-input) {
    .ProseMirror {
      @apply !h-8 !min-h-8 !py-1;
    }

    .nc-workflow-input-insert-btn {
      @apply !-top-0.5;
    }
  }

  .nc-key-value-row {
    @apply flex items-start gap-2;

    .nc-key-value-content {
      @apply flex items-start gap-2 flex-1;
    }
  }
}
</style>
