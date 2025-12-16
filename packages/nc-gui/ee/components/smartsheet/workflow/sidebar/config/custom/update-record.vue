<script setup lang="ts">
import { IntegrationsType } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import WorkflowFieldList from '~/components/smartsheet/workflow/sidebar/config/custom/common/WorkflowFieldList.vue'
interface UpdateRecordNodeConfig {
  modelId: string
  rowId: string
  fields: Record<string, any>
}

const { selectedNodeId, updateNode, selectedNode, fetchNodeIntegrationOptions } = useWorkflowOrThrow()

const workflowContext = inject(WorkflowVariableInj, null)

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const { base } = storeToRefs(useBase())

const config = computed<UpdateRecordNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {
    modelId: '',
    rowId: '',
    fields: {},
  }) as UpdateRecordNodeConfig
})

const tableOptions = ref<any[]>([])

const columns = ref<
  Array<{
    label: string
    value: string
    ncItemDisabled: boolean
    column: ColumnType
  }>
>([])

const updateConfig = (updates: Partial<UpdateRecordNodeConfig>) => {
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

const loadConfig = async (key: string) => {
  if (!selectedNode.value) return
  try {
    const options = await fetchNodeIntegrationOptions(
      {
        type: IntegrationsType.WorkflowNode,
        sub_type: selectedNode.value.type,
        config: config.value,
      },
      key,
    )

    if (key === 'tables') {
      tableOptions.value = options || []
    } else if (key === 'fields') {
      columns.value = options || []
    }
  } catch (e) {
    console.error('Failed to load tables:', e)
  } finally {
    if (key === 'tables' && config.value.modelId) {
      await Promise.all([loadConfig('fields')])
    }
  }
}

const meta = computed(() => {
  const table = tableOptions.value.find((t) => t.table.id === config.value.modelId)?.table
  if (!table) return null
  table.columns = columns.value.map((col) => col.column)
  table.columnsById = columns.value.reduce((acc, col) => {
    acc[col.column.id] = col.column
    return acc
  }, {} as Record<string, ColumnType>)
  return table
})

const onTableSelect = async (tableId?: string | null) => {
  if (!tableId) {
    columns.value = []
    return
  }
  updateConfig({
    modelId: tableId,
    rowId: config.value.rowId,
    fields: {},
  })

  await loadConfig('fields')
}

const updateRowId = (rowId: string) => {
  updateConfig({ rowId })
}

const updateFields = (fields: Record<string, any>) => {
  updateConfig({ fields })
}

onMounted(() => {
  loadConfig('tables')
})
</script>

<template>
  <div class="update-record-config flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Table</label>
      <NcFormBuilderInputSelectTable
        :value="config.modelId"
        :base-id="base?.id"
        :multiple="false"
        :options="tableOptions"
        @update:value="onTableSelect"
      />
    </div>

    <div v-if="config.modelId" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Record ID</label>
      <NcFormBuilderInputWorkflowInput
        :model-value="config.rowId"
        :variables="flatVariables"
        :grouped-variables="groupedVariables"
        placeholder="Enter the record ID"
        @update:model-value="updateRowId"
      />
    </div>

    <WorkflowFieldList
      v-if="config.modelId && columns.length > 0"
      :model-value="config.fields"
      :columns="columns"
      :meta="meta"
      @update:model-value="updateFields"
    />
  </div>
</template>
