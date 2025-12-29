<script setup lang="ts">
import type { ExecuteScriptNodeConfig, ScriptVariable } from './types'

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

const variables = computed({
  get: () => config.value.variables || [],
  set: (value: ScriptVariable[]) => {
    updateConfig({ variables: value })
  },
})

const updateVariable = (index: number, field: 'name' | 'value', value: any) => {
  const newVariables = [...variables.value]
  newVariables[index] = {
    ...newVariables[index],
    [field]: value,
  }
  variables.value = newVariables
}

const removeVariable = (index: number) => {
  const newVariables = [...variables.value]
  newVariables.splice(index, 1)
  variables.value = newVariables
}

const addVariable = () => {
  const newUniqueName = ''
  variables.value.push({
    name: newUniqueName,
    value: '',
  })
}
</script>

<template>
  <div class="border-r-1 border-b-1 h-full">
    <div class="text-nc-content-gray-emphasis px-3 border-b-1 text-captionBold py-2">Variables</div>

    <NcGroupedSettings class="!px-3" title="Inputs">
      <div class="text-nc-content-gray text-bodySm">
        These let you use values from previous automation triggers and actions. Use in your script with input.config().
      </div>

      <div
        v-for="(variable, index) in variables"
        :key="index"
        class="border-1 relative border-nc-border-gray-light flex flex-col gap-2 p-2"
      >
        <div class="flex gap-2 flex-col">
          <div class="flex items-center justify-between">
            <span class="text-nc-content-gray-emphasis">Name</span>
            <NcButton size="xxsmall" class="!hover:bg-nc-bg-red-light" type="text" @click="removeVariable(index)">
              <GeneralIcon icon="ncTrash" class="text-nc-content-red-medium" />
            </NcButton>
          </div>
          <a-input v-model:value="variable.name" class="nc-input-sm" />
        </div>
        <div class="flex gap-2 flex-col">
          <label>Value</label>
          <NcFormBuilderInputWorkflowInput
            :model-value="variable.value"
            :variables="flatVariables"
            :grouped-variables="groupedVariables"
            placeholder="Variable value"
            @update:model-value="(val) => updateVariable(index, 'value', val)"
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
