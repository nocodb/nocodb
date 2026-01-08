<script setup lang="ts">
import type { ExecuteScriptNodeConfig } from './types'
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
    },
  })
}

const variables = computed({
  get: () => config.value.variables || {},
  set: (value: Record<string, any>) => {
    updateConfig({ variables: value })
  },
})

const updateVariable = (key: string, value: any) => {
  const newVariables = { ...variables.value }
  newVariables[key] = value
  variables.value = newVariables
}
</script>

<template>
  <div class="execute-script-config flex flex-col gap-4">
    <div :key="editModal" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Input Variables</label>
      <div v-if="Object.keys(variables).length === 0" class="text-xs text-nc-content-gray-subtle">
        Add variables that will be accessible via input.config() in your script
      </div>

      <div v-if="Object.keys(variables).length !== 0" class="text-xs text-nc-content-gray-subtle">
        Variables accessible via input.config() are listed here. Use Edit code to add more variables.
      </div>

      <template v-for="(value, key) in variables" :key="key">
        <div class="flex gap-2 flex-col">
          <div>
            {{ key }}
          </div>
          <NcFormBuilderInputWorkflowInput
            :model-value="value"
            :variables="flatVariables"
            :grouped-variables="groupedVariables"
            placeholder="Variable value"
            @update:model-value="(val) => updateVariable(key, val)"
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
