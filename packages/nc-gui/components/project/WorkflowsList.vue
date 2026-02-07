<script lang="ts" setup>
import type { WorkflowType } from 'nocodb-sdk'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { storeToRefs } from 'pinia'

dayjs.extend(relativeTime)

const props = defineProps<{
  baseId?: string
}>()

const baseId = toRef(props, 'baseId')

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

// Workflow store
const workflowStore = useWorkflowStore()
const { activeBaseWorkflows, isLoadingWorkflow } = storeToRefs(workflowStore)
const { loadWorkflows, openNewWorkflowModal, updateWorkflow, deleteWorkflow, duplicateWorkflow, publishWorkflow, loadWorkflowExecutions } = workflowStore

// Search functionality
const searchQuery = ref('')

// Workflow execution history storage
const workflowExecutions = ref<Map<string, any[]>>(new Map())

// Get workflows for current base
const workflows = computed(() => {
  return activeBaseWorkflows.value || []
})

// Filtered workflows based on search
const filteredWorkflows = computed(() => {
  if (!searchQuery.value) return workflows.value
  
  return workflows.value.filter(workflow => 
    workflow.title?.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Workflow count
const workflowCount = computed(() => workflows.value.length)

// Handle create workflow
const handleCreateWorkflow = async () => {
  if (!baseId.value) return
  
  $e('a:workflow:create')
  await openNewWorkflowModal({
    baseId: baseId.value,
    loadWorkflowsOnClose: true
  })
}

// Handle workflow actions
const handleEdit = (workflow: WorkflowType) => {
  $e('a:workflow:edit')
  // Navigate to workflow editor
  const { ncNavigateTo } = useGlobal()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())
  
  ncNavigateTo({
    workspaceId: activeWorkspaceId.value!,
    baseId: baseId.value!,
    workflowId: workflow.id!,
    workflowTitle: workflow.title
  })
}

const isDeleting = ref<string | null>(null)
const handleDelete = async (workflow: WorkflowType) => {
  if (!baseId.value || !workflow.id || isDeleting.value === workflow.id) return
  
  try {
    isDeleting.value = workflow.id
    $e('a:workflow:delete')
    await deleteWorkflow(baseId.value, workflow.id)
    message.toast(t('msg.success.workflowDeleted'))
  } catch (error) {
    console.error('Error deleting workflow:', error)
  } finally {
    isDeleting.value = null
  }
}

const isDuplicating = ref<string | null>(null)
const handleDuplicate = async (workflow: WorkflowType) => {
  if (!baseId.value || !workflow.id || isDuplicating.value === workflow.id) return
  
  try {
    isDuplicating.value = workflow.id
    $e('a:workflow:duplicate')
    
    // Store the current duplicateWorkflow method
    const originalDuplicate = workflowStore.duplicateWorkflow
    
    // Override temporarily to prevent navigation
    workflowStore.duplicateWorkflow = async (baseId: string, workflowId: string) => {
      const result = await originalDuplicate.call(workflowStore, baseId, workflowId)
      // Don't navigate - just reload workflows
      await loadWorkflows({ baseId, force: true })
      return result
    }
    
    await workflowStore.duplicateWorkflow(baseId.value, workflow.id)
    
    // Restore original method
    workflowStore.duplicateWorkflow = originalDuplicate
    
    message.toast(t('msg.success.workflowDuplicated'))
  } catch (error) {
    console.error('Error duplicating workflow:', error)
    message.toast(t('msg.error.workflowDuplicateFailed'))
  } finally {
    isDuplicating.value = null
  }
}

const isToggling = ref<string | null>(null)
const handleToggleStatus = async (workflow: WorkflowType, newStatus?: boolean) => {
  if (!baseId.value || !workflow.id || isToggling.value === workflow.id) return
  
  try {
    isToggling.value = workflow.id
    $e('a:workflow:toggle-status')
    
    // Use provided status or toggle current enabled status
    const targetStatus = newStatus !== undefined ? newStatus : !workflow.enabled
    
    if (!targetStatus) {
      // Disable workflow - update enabled status
      await updateWorkflow(baseId.value, workflow.id, { enabled: false })
      message.toast(t('msg.success.workflowDisabled'))
    } else {
      // Enable workflow - update enabled status
      await updateWorkflow(baseId.value, workflow.id, { enabled: true })
      message.toast(t('msg.success.workflowEnabled'))
    }
    
  } catch (error) {
    console.error('Error toggling workflow status:', error)
    message.toast(t('msg.error.workflowToggleFailed'))
  } finally {
    isToggling.value = null
  }
}

// Get trigger type display
const getTriggerType = (workflow: WorkflowType) => {
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) return '—'
  
  // Find trigger node (nodes with no incoming edges or specific trigger types)
  const triggerNode = workflow.nodes.find(node => {
    if (!node.type) return false
    
    // Check if this is a trigger node type
    const triggerTypes = [
      'recordCreated', 'recordUpdated', 'recordDeleted',
      'schedule', 'webhook', 'manual'
    ]
    
    return triggerTypes.some(type => node.type.includes(type)) ||
           node.type.includes('trigger') ||
           node.type.includes('Trigger')
  })
  
  if (!triggerNode) return '—'
  
  // Map node types to display names
  const typeMap: Record<string, string> = {
    'recordCreated': 'Record Created',
    'recordUpdated': 'Record Updated', 
    'recordDeleted': 'Record Deleted',
    'schedule': 'Scheduled',
    'webhook': 'Webhook',
    'manual': 'Manual'
  }
  
  for (const [type, display] of Object.entries(typeMap)) {
    if (triggerNode.type.includes(type)) {
      return display
    }
  }
  
  return triggerNode.data?.title || triggerNode.type || '—'
}

// Get last run display
const getLastRunDisplay = (workflow: WorkflowType) => {
  if (!workflow.id) return '—'
  
  const executions = workflowExecutions.value.get(workflow.id) || []
  if (executions.length === 0) return '—'
  
  const lastExecution = executions[0] // Most recent execution
  if (!lastExecution.finished_at) return 'Running...'
  
  const timeAgo = dayjs(lastExecution.finished_at).fromNow()
  const status = lastExecution.status
  
  // Create a status badge with color
  const statusColors: Record<string, string> = {
    'success': 'text-green-600',
    'error': 'text-red-600', 
    'in_progress': 'text-blue-600',
    'cancelled': 'text-gray-600',
    'pending': 'text-yellow-600',
    'waiting': 'text-orange-600'
  }
  
  return {
    timeAgo,
    status,
    statusColor: statusColors[status] || 'text-gray-600'
  }
}

// Load workflow execution data
const loadWorkflowExecutionData = async (workflowId: string) => {
  try {
    const executions = await loadWorkflowExecutions({ 
      workflowId, 
      limit: 1 // Only get the most recent execution
    })
    workflowExecutions.value.set(workflowId, executions)
  } catch (error) {
    console.error('Error loading workflow executions:', error)
    workflowExecutions.value.set(workflowId, [])
  }
}

// Load workflows and their execution data
const loadAllWorkflowData = async (baseId: string) => {
  await loadWorkflows({ baseId })
  // Load execution data for all workflows
  const promises = workflows.value.map(workflow => 
    workflow.id ? loadWorkflowExecutionData(workflow.id) : Promise.resolve()
  )
  await Promise.all(promises)
}

// Handle table row click to edit workflow  
const handleRowClick = (workflow: WorkflowType) => {
  handleEdit(workflow)
}

// Load workflows on mount
onMounted(async () => {
  if (baseId.value) {
    await loadAllWorkflowData(baseId.value)
  }
})

// Watch for baseId changes
watch(baseId, async (newBaseId) => {
  if (newBaseId) {
    await loadAllWorkflowData(newBaseId)
  }
}, { immediate: true })
</script>

<template>
  <div class="nc-workflows-list h-full flex flex-col">
    <!-- Header with search and create button -->
    <div class="flex items-center justify-between mb-4 gap-3">
      <div class="flex-1 max-w-96">
        <a-input
          v-model:value="searchQuery"
          :placeholder="$t('placeholder.searchWorkflows')"
          allow-clear
          class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
        >
          <template #prefix>
            <GeneralIcon
              icon="search"
              class="mr-2 h-4 w-4 text-nc-content-gray-muted group-hover:text-nc-content-gray-extreme"
            />
          </template>
        </a-input>
      </div>
      
      <NcButton
        v-if="isUIAllowed('workflowCreateOrEdit')"
        type="primary"
        size="small"
        class="nc-workflows-create-btn"
        @click="handleCreateWorkflow"
      >
        <template #icon>
          <GeneralIcon icon="plus" />
        </template>
        {{ $t('activity.createWorkflow') }}
      </NcButton>
    </div>

    <!-- Workflows table -->
    <div class="flex-1 overflow-auto">
      <a-table
        v-if="filteredWorkflows.length"
        :data-source="filteredWorkflows"
        :columns="[
          {
            title: $t('labels.status'),
            dataIndex: 'status', 
            key: 'status',
            width: 40,
          },
          {
            title: $t('general.name'),
            dataIndex: 'title',
            key: 'title',
            width: '30%',
          },
          {
            title: $t('labels.createdBy'),
            key: 'createdBy',
            width: '15%',
          },
          {
            title: $t('general.trigger'),
            key: 'trigger',
            width: '15%',
          },
          {
            title: $t('labels.lastExecuted'),
            dataIndex: 'lastRun',
            key: 'lastRun', 
            width: '15%',
          },
          {
            title: $t('general.actions'),
            key: 'actions',
            width: '10%',
          },
        ]"
        :pagination="false"
        class="nc-workflows-table"
        size="small"
        :customRow="(record) => ({ onClick: () => handleRowClick(record) })"
      >
        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'status'" @click.stop>
            <NcSwitch
              size="small"
              :checked="!!record.enabled"
              :disabled="isToggling === record.id"
              @change="(checked) => handleToggleStatus(record, checked)"
            />
          </div>
          <div v-else-if="column.key === 'title'" class="flex items-center gap-2">
            <GeneralIcon icon="ncAutomation" class="text-nc-content-brand" />
            <span 
              :title="record.title" 
              class="font-medium cursor-pointer hover:text-nc-content-brand truncate" 
              @click.stop="handleEdit(record)"
            >
              {{ record.title }}
            </span>
          </div>
          
          <div v-else-if="column.key === 'createdBy'">
            <span v-if="record.created_by_user" class="text-gray-600">
              {{ record.created_by_user.display_name || record.created_by_user.email }}
            </span>
            <span v-else class="text-gray-400">—</span>
          </div>
          
          <div v-else-if="column.key === 'trigger'">
            {{ getTriggerType(record) }}
          </div>
          
          <div v-else-if="column.key === 'lastRun'">
            <template v-if="typeof getLastRunDisplay(record) === 'object'">
              <div class="flex flex-col">
                <span :class="getLastRunDisplay(record).statusColor" class="text-xs font-medium">
                  {{ getLastRunDisplay(record).status }}
                </span>
                <span class="text-gray-500 text-xs">{{ getLastRunDisplay(record).timeAgo }}</span>
              </div>
            </template>
            <span v-else class="text-gray-600 text-sm">{{ getLastRunDisplay(record) }}</span>
          </div>
          
          <div v-else-if="column.key === 'actions'" @click.stop>
            <NcDropdown>
              <NcButton type="text" size="small">
                <GeneralIcon icon="threeDotVertical" />
              </NcButton>
              
              <template #overlay>
                <NcMenu>
                  <NcMenuItem @click="handleEdit(record)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncEdit" />
                      {{ $t('general.edit') }}
                    </div>
                  </NcMenuItem>
                  <NcMenuItem :disabled="isToggling === record.id" @click="() => handleToggleStatus(record)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon :icon="record.enabled ? 'ncPause' : 'ncPlay'" />
                      {{ record.enabled ? $t('general.disable') : $t('general.enable') }}
                    </div>
                  </NcMenuItem>
                  <NcMenuItem :disabled="isDuplicating === record.id" @click="handleDuplicate(record)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncCopy" />
                      {{ $t('general.duplicate') }}
                    </div>
                  </NcMenuItem>
                  <NcMenuDivider />
                  <NcMenuItem class="!text-red-500" :disabled="isDeleting === record.id" @click="handleDelete(record)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncTrash" />
                      {{ $t('general.delete') }}
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>
      </a-table>
      
      <!-- Empty state -->
      <div v-else class="h-full flex flex-col items-center justify-center text-center">
        <GeneralIcon icon="ncAutomation" class="text-6xl text-gray-300 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          {{ searchQuery ? $t('msg.info.noWorkflowsFound') : $t('msg.info.noWorkflows') }}
        </h3>
        <p class="text-gray-500 mb-4">
          {{ 
            searchQuery 
              ? $t('msg.info.tryDifferentSearch')
              : $t('msg.info.createFirstWorkflow') 
          }}
        </p>
        <NcButton
          v-if="!searchQuery && isUIAllowed('workflowCreateOrEdit')" 
          type="primary"
          @click="handleCreateWorkflow"
        >
          <template #icon>
            <GeneralIcon icon="plus" />
          </template>
          {{ $t('activity.createWorkflow') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-workflows-list {
  @apply p-4;
}

/* Search styling now handled by nc-input-border-on-value classes */

:deep(.nc-workflows-table) {
  .ant-table {
    @apply !bg-transparent;
  }
  
  .ant-table-thead > tr > th {
    @apply !bg-gray-50 !border-gray-200 !text-gray-700 !font-medium;
  }
  
  .ant-table-tbody > tr {
    @apply hover:!bg-gray-50 cursor-pointer;
    
    > td {
      @apply !border-gray-200;
    }
  }
}
</style>