<script setup lang="ts">
import type { ExecuteScriptNodeConfig, ScriptVariable } from './types'
import EditModal from '~/components/smartsheet/workflow/sidebar/config/custom/RunScript/EditModal.vue'

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const workflowContext = inject(WorkflowVariableInj, null)

const editModal = ref(false)

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
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Input Variables</label>
      <div v-if="variables.filter((v) => v.name).length === 0" class="text-xs text-nc-content-gray-subtle">
        Add variables that will be accessible via <code class="px-1 py-0.5 bg-nc-bg-gray-light rounded">input.config()</code> in
        your script
      </div>

      <template v-for="(variable, index) in variables.filter((v) => v.name)" :key="variable.name">
        <div class="flex gap-2 flex-col">
          <div>
            {{ variable.name }}
          </div>
          <NcFormBuilderInputWorkflowInput
            :model-value="variable.value"
            :variables="flatVariables"
            :grouped-variables="groupedVariables"
            placeholder="Variable value"
            @update:model-value="(val) => updateVariable(index, 'value', val)"
          />
        </div>
      </template>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-nc-content-gray-emphasis">Script</label>

        <NcButton size="small" type="secondary" @click="editModal = true">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCode" />
            Edit code
          </div>
        </NcButton>
      </div>

      <div class="font-mono bg-nc-bg-gray-extralight px-3 py-2">
        <template v-if="scriptCode">
          {{ scriptCode }}
        </template>
        <span v-else class="text-nc-content-gray-muted font-mono"> No script provided </span>
      </div>
    </div>

    <EditModal v-model:value="editModal" />
  </div>
</template>

<style scoped lang="scss">
code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
}
</style>
