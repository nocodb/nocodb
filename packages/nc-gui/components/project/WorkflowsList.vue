<script lang="ts" setup>
import type { WorkflowType } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const baseId = toRef(props, 'baseId')

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

// Search functionality
const searchQuery = ref('')

// Mock data for now - will be replaced with actual workflow store
const workflows = ref<(WorkflowType & { lastRun?: string, status?: 'Active' | 'Inactive' })[]>([
  {
    id: '1',
    title: 'Email notification on new record',
    status: 'Active',
    lastRun: '2 hours ago',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-02-06T15:45:00Z',
  },
  {
    id: '2', 
    title: 'Update status on completion',
    status: 'Inactive',
    lastRun: '1 day ago',
    created_at: '2024-01-10T14:20:00Z',
    updated_at: '2024-02-05T09:30:00Z',
  },
  {
    id: '3',
    title: 'Slack notification for urgent tasks',
    status: 'Active',
    lastRun: '30 minutes ago', 
    created_at: '2024-01-20T09:15:00Z',
    updated_at: '2024-02-07T02:15:00Z',
  },
])

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
const handleCreateWorkflow = () => {
  $e('a:workflow:create')
  // TODO: Open create workflow modal
  console.log('Create workflow')
}

// Handle workflow actions
const handleEdit = (workflow: WorkflowType) => {
  $e('a:workflow:edit')
  console.log('Edit workflow:', workflow.id)
}

const handleDelete = (workflow: WorkflowType) => {
  $e('a:workflow:delete') 
  console.log('Delete workflow:', workflow.id)
}

const handleDuplicate = (workflow: WorkflowType) => {
  $e('a:workflow:duplicate')
  console.log('Duplicate workflow:', workflow.id)
}

const handleToggleStatus = (workflow: WorkflowType & { status?: 'Active' | 'Inactive' }) => {
  $e('a:workflow:toggle-status')
  workflow.status = workflow.status === 'Active' ? 'Inactive' : 'Active'
}

// Get status badge color
const getStatusColor = (status: 'Active' | 'Inactive') => {
  return status === 'Active' ? 'green' : 'gray'
}

// Get trigger type display
const getTriggerType = (workflow: WorkflowType) => {
  // TODO: Extract actual trigger type from workflow
  return 'Record Created'
}
</script>

<template>
  <div class="nc-workflows-list h-full flex flex-col">
    <!-- Header with search and create button -->
    <div class="flex items-center justify-between mb-4 gap-3">
      <div class="flex-1 max-w-96">
        <a-input
          v-model:value="searchQuery"
          :placeholder="$t('placeholder.searchWorkflows')"
          class="nc-workflows-search"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="text-gray-400" />
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
            title: $t('general.name'),
            dataIndex: 'title',
            key: 'title',
            width: '35%',
          },
          {
            title: $t('general.status'),
            dataIndex: 'status', 
            key: 'status',
            width: '15%',
          },
          {
            title: $t('general.trigger'),
            key: 'trigger',
            width: '20%',
          },
          {
            title: $t('general.lastRun'),
            dataIndex: 'lastRun',
            key: 'lastRun', 
            width: '20%',
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
      >
        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'title'" class="flex items-center gap-2">
            <GeneralIcon icon="ncAutomation" class="text-nc-content-brand" />
            <span class="font-medium">{{ record.title }}</span>
          </div>
          
          <div v-else-if="column.key === 'status'">
            <NcBadge
              :color="getStatusColor(record.status)"
              class="capitalize"
            >
              {{ record.status }}
            </NcBadge>
          </div>
          
          <div v-else-if="column.key === 'trigger'">
            {{ getTriggerType(record) }}
          </div>
          
          <div v-else-if="column.key === 'lastRun'">
            <span class="text-gray-600">{{ record.lastRun || '-' }}</span>
          </div>
          
          <div v-else-if="column.key === 'actions'">
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
                  <NcMenuItem @click="handleToggleStatus(record)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon :icon="record.status === 'Active' ? 'ncPause' : 'ncPlay'" />
                      {{ record.status === 'Active' ? $t('general.disable') : $t('general.enable') }}
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="handleDuplicate(record)">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncCopy" />
                      {{ $t('general.duplicate') }}
                    </div>
                  </NcMenuItem>
                  <NcMenuDivider />
                  <NcMenuItem class="!text-red-500" @click="handleDelete(record)">
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

.nc-workflows-search {
  @apply !h-8;
}

:deep(.nc-workflows-table) {
  .ant-table {
    @apply !bg-transparent;
  }
  
  .ant-table-thead > tr > th {
    @apply !bg-gray-50 !border-gray-200 !text-gray-700 !font-medium;
  }
  
  .ant-table-tbody > tr {
    @apply hover:!bg-gray-50;
    
    > td {
      @apply !border-gray-200;
    }
  }
}
</style>