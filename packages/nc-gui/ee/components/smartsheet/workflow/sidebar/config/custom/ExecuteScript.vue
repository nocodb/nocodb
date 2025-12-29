<script setup lang="ts">
interface ScriptVariable {
  name: string
  value: any
}

interface ExecuteScriptNodeConfig {
  script: string
  variables: ScriptVariable[]
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
    variables: [],
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
    },
  })
}

const scriptCode = computed({
  get: () => config.value.script || '',
  set: (value: string) => {
    updateConfig({ script: value })
  },
})

const variables = computed({
  get: () => config.value.variables || [],
  set: (value: ScriptVariable[]) => {
    updateConfig({ variables: value })
  },
})

const addVariable = () => {
  const newVariables = [...variables.value, { name: '', value: '' }]
  variables.value = newVariables
}

const removeVariable = (index: number) => {
  const newVariables = variables.value.filter((_, i) => i !== index)
  variables.value = newVariables
}

const updateVariable = (index: number, field: 'name' | 'value', value: any) => {
  const newVariables = [...variables.value]
  newVariables[index] = {
    ...newVariables[index],
    [field]: value,
  }
  variables.value = newVariables
}
</script>

<template>
  <div class="execute-script-config flex flex-col gap-4">
    <!-- Variables Section -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-nc-content-gray-emphasis">Input Variables</label>
        <NcButton size="xs" type="secondary" @click="addVariable">
          <template #icon>
            <GeneralIcon icon="ncPlus" class="w-4 h-4" />
          </template>
          Add Variable
        </NcButton>
      </div>

      <div v-if="variables.length === 0" class="text-xs text-nc-content-gray-subtle">
        Add variables that will be accessible via <code class="px-1 py-0.5 bg-nc-bg-gray-light rounded">input.config()</code> in
        your script
      </div>

      <div v-for="(variable, index) in variables" :key="index" class="flex gap-2 items-start">
        <div class="flex-1">
          <a-input
            v-model:value="variable.name"
            placeholder="Variable name"
            size="small"
            @update:value="(val) => updateVariable(index, 'name', val)"
          />
        </div>
        <div class="flex-1">
          <NcFormBuilderInputWorkflowInput
            :model-value="variable.value"
            :variables="flatVariables"
            :grouped-variables="groupedVariables"
            placeholder="Variable value"
            @update:model-value="(val) => updateVariable(index, 'value', val)"
          />
        </div>
        <NcButton size="xs" type="text" @click="removeVariable(index)">
          <template #icon>
            <GeneralIcon icon="ncTrash" class="w-4 h-4 text-nc-content-red-dark" />
          </template>
        </NcButton>
      </div>
    </div>

    <!-- Script Editor Section -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Script</label>
      <div class="text-xs text-nc-content-gray-subtle mb-2">
        Use <code class="px-1 py-0.5 bg-nc-bg-gray-light rounded">input.config()</code> to access variables and
        <code class="px-1 py-0.5 bg-nc-bg-gray-light rounded">output.set(key, value)</code> to set outputs.
      </div>

      <MonacoEditor
        v-model="scriptCode"
        class="!h-96 border-1 border-nc-border-gray-medium rounded-lg overflow-hidden"
        lang="javascript"
        :validate="false"
        hide-minimap
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
}
</style>
