<script lang="ts" setup>
import type { WorkflowType } from 'nocodb-sdk'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

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
const {
  loadWorkflows,
  openNewWorkflowModal,
  updateWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
  publishWorkflow,
  loadWorkflowExecutions,
} = workflowStore

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

  return workflows.value.filter((workflow) => searchCompare(workflow.title, searchQuery.value))
})

// Workflow count
const workflowCount = computed(() => workflows.value.length)

// Handle create workflow
const handleCreateWorkflow = async () => {
  if (!baseId.value) return

  $e('a:workflow:create')
  await openNewWorkflowModal({
    baseId: baseId.value,
    loadWorkflowsOnClose: true,
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
    workflowTitle: workflow.title,
  })
}

const handleLogs = (workflow: WorkflowType) => {
  $e('a:workflow:logs')
  // Navigate to workflow logs tab
  const { ncNavigateTo } = useGlobal()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value!,
    baseId: baseId.value!,
    workflowId: workflow.id!,
    workflowTitle: workflow.title,
    query: { tab: 'logs' },
  })
}

const handleSettings = (workflow: WorkflowType) => {
  $e('a:workflow:settings')
  // Navigate to workflow settings tab
  const { ncNavigateTo } = useGlobal()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value!,
    baseId: baseId.value!,
    workflowId: workflow.id!,
    workflowTitle: workflow.title,
    query: { tab: 'settings' },
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

// Get trigger type display with icon
const getTriggerType = (workflow: WorkflowType) => {
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) return { text: '—', icon: null }

  // Find trigger node (nodes with no incoming edges or specific trigger types)
  const triggerNode = workflow.nodes.find((node) => {
    if (!node.type) return false

    // Check if this is a trigger node type
    const triggerTypes = [
      'recordCreated',
      'recordUpdated',
      'recordDeleted',
      'schedule',
      'webhook',
      'manual',
      'after_insert',
      'after_update',
      'after_delete',
      'cron',
    ]

    return triggerTypes.some((type) => node.type.includes(type)) || node.type.includes('trigger') || node.type.includes('Trigger')
  })

  if (!triggerNode) return { text: '—', icon: null }

  // Map node types to display names and icons
  const typeMap: Record<string, { text: string; icon: string }> = {
    after_insert: { text: 'Record Created', icon: 'ncRecordCreate' },
    recordCreated: { text: 'Record Created', icon: 'ncRecordCreate' },
    after_update: { text: 'Record Updated', icon: 'ncRecordUpdate' },
    recordUpdated: { text: 'Record Updated', icon: 'ncRecordUpdate' },
    after_delete: { text: 'Record Deleted', icon: 'ncRecordDelete' },
    recordDeleted: { text: 'Record Deleted', icon: 'ncRecordDelete' },
    cron: { text: 'At scheduled time', icon: 'ncClock' },
    schedule: { text: 'At scheduled time', icon: 'ncClock' },
    webhook: { text: 'When webhook received', icon: 'ncWebhook' },
    manual: { text: 'When manually triggered', icon: 'ncPlay' },
  }

  for (const [type, config] of Object.entries(typeMap)) {
    if (triggerNode.type.includes(type)) {
      return config
    }
  }

  return { text: triggerNode.data?.title || triggerNode.type || '—', icon: null }
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
    success: 'text-green-600',
    error: 'text-red-600',
    in_progress: 'text-blue-600',
    cancelled: 'text-gray-600',
    pending: 'text-yellow-600',
    waiting: 'text-orange-600',
  }

  return {
    timeAgo,
    status,
    statusColor: statusColors[status] || 'text-gray-600',
  }
}

// Load workflow execution data
const loadWorkflowExecutionData = async (workflowId: string) => {
  try {
    const executions = await loadWorkflowExecutions({
      workflowId,
      limit: 1, // Only get the most recent execution
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
  const promises = workflows.value.map((workflow) => (workflow.id ? loadWorkflowExecutionData(workflow.id) : Promise.resolve()))
  await Promise.all(promises)
}

// Table columns definition
const columns = [
  {
    key: 'status',
    title: t('labels.status'),
    width: 80,
    minWidth: 80,
  },
  {
    key: 'title',
    title: t('general.name'),
    minWidth: 180,
    dataIndex: 'title',
    showOrderBy: true,
  },
  {
    key: 'createdBy',
    title: t('labels.createdBy'),
    basis: '20%',
    minWidth: 200,
  },
  {
    key: 'trigger',
    title: t('general.trigger'),
    basis: '20%',
    minWidth: 180,
  },
  {
    key: 'lastRun',
    title: t('labels.lastExecuted'),
    basis: '20%',
    minWidth: 180,
  },
  {
    key: 'action',
    title: t('general.actions'),
    width: 80,
    minWidth: 80,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const orderBy = ref<Record<string, SordDirectionType>>({})

const customRow = (record: Record<string, any>) => ({
  class: 'workflow-row cursor-pointer',
  onClick: (e: Event) => {
    e.stopPropagation()
    onRowClick(record)
  },
})

const onRowClick = (record: Record<string, any>) => {
  handleEdit(record as WorkflowType)
}

// Load workflows on mount
onMounted(async () => {
  if (baseId.value) {
    await loadAllWorkflowData(baseId.value)
  }
})

// Watch for baseId changes
watch(
  baseId,
  async (newBaseId) => {
    if (newBaseId) {
      await loadAllWorkflowData(newBaseId)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-workflows-list h-full flex flex-col items-center gap-6">
    <div class="w-full flex justify-between items-center max-w-full gap-3">
      <a-input
        v-model:value="searchQuery"
        :placeholder="$t('placeholder.searchWorkflows')"
        allow-clear
        class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted group-hover:text-nc-content-gray-extreme" />
        </template>
      </a-input>

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

    <NcTable
      v-model:order-by="orderBy"
      :is-data-loading="isLoadingWorkflow"
      :columns="columns"
      :data="filteredWorkflows"
      :bordered="false"
      :custom-row="customRow"
      :pagination="true"
      :pagination-offset="25"
      class="flex-1 nc-workflows-table max-w-full"
    >
      <template #emptyText>
        <div class="flex flex-col items-center justify-center text-center py-8">
          <GeneralIcon icon="ncAutomation" class="h-15 w-15 text-gray-300 mb-4" />
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            {{ searchQuery ? $t('placeholder.noWorkflowsFound') : $t('placeholder.noWorkflows') }}
          </h3>
          <p class="text-gray-500 mb-4">
            {{ searchQuery ? $t('placeholder.tryDifferentSearch') : $t('placeholder.createWorkflow') }}
          </p>
          <NcButton
            v-if="!searchQuery && isUIAllowed('workflowCreateOrEdit')"
            type="primary"
            size="small"
            @click="handleCreateWorkflow"
          >
            <template #icon>
              <GeneralIcon icon="plus" />
            </template>
            {{ $t('activity.createWorkflow') }}
          </NcButton>
        </div>
      </template>

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
          <GeneralIcon icon="ncAutomation" class="flex-none text-nc-content-brand" />
          <NcTooltip class="truncate font-medium min-w-0" show-on-truncate-only>
            <template #title>
              {{ record.title }}
            </template>
            {{ record.title }}
          </NcTooltip>
        </div>

        <div v-else-if="column.key === 'createdBy'">
          <NcUserInfo v-if="record.created_by_user" :user="record.created_by_user" />
          <span v-else class="text-nc-content-gray-muted">—</span>
        </div>

        <div v-else-if="column.key === 'trigger'" class="flex items-center gap-2">
          <div
            v-if="getTriggerType(record).icon"
            class="bg-nc-bg-brand text-nc-content-brand-disabled w-6 h-6 flex items-center justify-center rounded-md p-1 flex-none"
          >
            <GeneralIcon :icon="getTriggerType(record).icon" class="!w-5 !h-5" />
          </div>
          <span class="truncate">{{ getTriggerType(record).text }}</span>
        </div>

        <div v-else-if="column.key === 'lastRun'">
          <template v-if="typeof getLastRunDisplay(record) === 'object'">
            <div class="flex flex-col">
              <span :class="getLastRunDisplay(record).statusColor" class="text-xs font-medium capitalize">
                {{ getLastRunDisplay(record).status }}
              </span>
              <span class="text-nc-content-gray-muted text-xs">{{ getLastRunDisplay(record).timeAgo }}</span>
            </div>
          </template>
          <span v-else class="text-nc-content-gray-muted text-sm">{{ getLastRunDisplay(record) }}</span>
        </div>

        <div v-else-if="column.key === 'action'" @click.stop>
          <NcDropdown placement="bottomRight">
            <NcButton size="small" type="secondary">
              <component :is="iconMap.ncMoreVertical" />
            </NcButton>

            <template #overlay>
              <NcMenu variant="small">
                <NcMenuItem @click="handleEdit(record)">
                  <GeneralIcon icon="ncEdit" />
                  {{ $t('general.edit') }}
                </NcMenuItem>
                <NcMenuItem @click="handleLogs(record)">
                  <GeneralIcon icon="audit" />
                  {{ $t('general.logs') }}
                </NcMenuItem>
                <NcMenuItem @click="handleSettings(record)">
                  <GeneralIcon icon="ncSettings" />
                  {{ $t('labels.settings') }}
                </NcMenuItem>
                <NcMenuDivider />
                <NcMenuItem :disabled="isToggling === record.id" @click="() => handleToggleStatus(record)">
                  <GeneralIcon :icon="record.enabled ? 'ncPause' : 'ncPlay'" />
                  {{ record.enabled ? $t('general.disable') : $t('general.enable') }}
                </NcMenuItem>
                <NcMenuItem :disabled="isDuplicating === record.id" @click="handleDuplicate(record)">
                  <GeneralIcon icon="ncCopy" />
                  {{ $t('general.duplicate') }}
                </NcMenuItem>
                <NcMenuDivider />
                <NcMenuItem class="!text-red-500" :disabled="isDeleting === record.id" @click="handleDelete(record)">
                  <GeneralIcon icon="delete" />
                  {{ $t('general.delete') }}
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>
      </template>
    </NcTable>
  </div>
</template>

<style lang="scss" scoped>
.nc-workflows-list {
  @apply px-4 md:px-6 pt-6;
}
</style>
