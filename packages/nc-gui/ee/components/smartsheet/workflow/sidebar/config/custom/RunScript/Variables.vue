<script setup lang="ts">
import type { ExecuteScriptNodeConfig } from './types'

interface VariableEntry {
  index: number
  key: string
  value: any
}

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const workflowContext = inject(WorkflowVariableInj, null)

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const config = computed<ExecuteScriptNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {
    script: '',
    variables: {},
  }) as ExecuteScriptNodeConfig
})

const updateConfig = (updates: Partial<ExecuteScriptNodeConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
      testResult: {
        ...(selectedNode.value?.data?.testResult || {}),
        isStale: true,
      },
    },
  })
}

const variables = computed({
  get: () => config.value.variables || {},
  set: (value: Record<string, any>) => {
    updateConfig({ variables: value })
  },
})

const variableEntries = computed<VariableEntry[]>(() => {
  return Object.entries(variables.value).map(([key, value], index) => ({
    index,
    key,
    value,
  }))
})

const updateVariableEntry = (index: number, newKey: string, newValue: any) => {
  const entries = Object.entries(variables.value)
  if (index < 0 || index >= entries.length) return

  const newVariables: Record<string, any> = {}

  entries.forEach(([key, value], i) => {
    if (i === index) {
      newVariables[newKey] = newValue
    } else {
      newVariables[key] = value
    }
  })

  variables.value = newVariables
}

const removeVariable = (index: number) => {
  const entries = Object.entries(variables.value)
  if (index < 0 || index >= entries.length) return

  const newVariables: Record<string, any> = {}

  entries.forEach(([key, value], i) => {
    if (i !== index) {
      newVariables[key] = value
    }
  })

  variables.value = newVariables
}

const addVariable = () => {
  const newVariables = { ...variables.value }
  let counter = 1
  let newKey = `variable${counter}`
  while (newKey in newVariables) {
    counter++
    newKey = `variable${counter}`
  }
  newVariables[newKey] = ''
  variables.value = newVariables
}
</script>

<template>
  <div class="border-r-1 border-b-1 h-full overflow-y-auto nc-scrollbar-x-md">
    <div class="text-nc-content-gray-emphasis px-3 border-b-1 text-captionBold py-2">Variables</div>

    <NcGroupedSettings class="!px-3" title="Inputs">
      <div class="text-nc-content-gray text-bodySm">
        These let you use values from previous automation triggers and actions. Use in your script with input.config().
      </div>

      <div
        v-for="entry in variableEntries"
        :key="entry.index"
        class="border-1 relative border-nc-border-gray-light flex flex-col gap-2 p-2"
      >
        <div class="flex gap-2 flex-col">
          <div class="flex items-center justify-between">
            <span class="text-nc-content-gray-emphasis">Name</span>
            <NcButton size="xxsmall" class="!hover:bg-nc-bg-red-light" type="text" @click="removeVariable(entry.index)">
              <GeneralIcon icon="ncTrash" class="text-nc-content-red-medium" />
            </NcButton>
          </div>
          <a-input
            :value="entry.key"
            class="nc-input-sm"
            @update:value="(newKey) => updateVariableEntry(entry.index, newKey, entry.value)"
          />
        </div>
        <div class="flex gap-2 flex-col">
          <label>Value</label>
          <NcFormBuilderInputWorkflowInput
            :model-value="entry.value"
            :variables="flatVariables"
            :grouped-variables="groupedVariables"
            placeholder="Variable value"
            @update:model-value="(val) => updateVariableEntry(entry.index, entry.key, val)"
          />
        </div>
      </div>
      <div>
        <NcButton size="small" type="text" @click="addVariable">
          <div class="flex gap-2 text-nc-content-brand items-center">
            <GeneralIcon icon="ncPlus" />
            Add input variable
          </div>
        </NcButton>
      </div>
    </NcGroupedSettings>
  </div>
</template>

<style scoped lang="scss"></style>
