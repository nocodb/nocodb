<script setup lang="ts">
import type { DashboardType, WorkflowType } from 'nocodb-sdk'
import { DependencyTableType } from 'nocodb-sdk'

interface Props {
  status?: 'loading' | 'error' | 'done'
  hasBreakingChanges?: boolean
  entities?: Array<{
    type: DependencyTableType
    entity: DashboardType | WorkflowType
  }>
  action?: 'delete' | 'update' | 'rename' | string
  entityType?: DependencyTableType | string
}

const props = withDefaults(defineProps<Props>(), {
  status: 'done',
  hasBreakingChanges: false,
  entities: () => [],
  action: 'delete',
  entityType: 'view',
})

const { t } = useI18n()

const workflows = computed(() => {
  return props.entities?.filter((e) => e.type === DependencyTableType.Workflow).map((e) => e.entity as WorkflowType) || []
})

const dashboards = computed(() => {
  return props.entities?.filter((e) => e.type === DependencyTableType.Widget).map((e) => e.entity as DashboardType) || []
})

const totalCount = computed(() => {
  return props.entities?.length || 0
})

const dependencyMessage = computed(() => {
  const gerundMap: Record<string, string> = {
    delete: 'deleting',
    update: 'updating',
    rename: 'renaming',
  }

  const gerundAction = gerundMap[props.action] || `${props.action}ing`
  const actionText = t(`general.${gerundAction}`)
  const entityText = t(`objects.${props.entityType}`)
  return t('labels.changingEntityWillImpact', {
    action: actionText.toLowerCase(),
    entity: entityText,
    count: totalCount.value,
  })
})
</script>

<template>
  <div>
    <div v-if="status === 'loading'" class="flex items-center gap-2 text-nc-content-gray-muted">
      <GeneralLoader size="regular" />
      <span>{{ $t('labels.checkingDependencies') }}</span>
    </div>

    <div v-else-if="status === 'done' && hasBreakingChanges && totalCount > 0">
      <div class="flex items-start gap-2 p-3 bg-nc-orange-50 rounded-lg border border-orange-200">
        <GeneralIcon icon="warning" class="flex-none text-orange-500 mt-0.5" />
        <div class="flex-1">
          <div class="font-semibold text-nc-content-gray-emphasis mb-3">
            {{ dependencyMessage }}
          </div>

          <div v-if="workflows && workflows.length > 0" class="mb-3">
            <div class="text-sm font-medium text-nc-content-gray-emphasis mb-2">
              {{ $t('objects.workflows') }} ({{ workflows.length }})
            </div>
            <div class="space-y-1.5">
              <div
                v-for="workflow in workflows"
                :key="workflow.id"
                class="flex items-center gap-2 text-sm text-nc-content-gray-subtle hover:text-nc-content-gray-emphasis transition-colors cursor-pointer"
              >
                <NcIconWorkflow :workflow="workflow" class="w-4 h-4 flex-none" />
                <span class="truncate">{{ workflow.title }}</span>
              </div>
            </div>
          </div>

          <div v-if="dashboards && dashboards.length > 0">
            <div class="text-sm font-medium text-nc-content-gray-emphasis mb-2">
              {{ $t('objects.dashboards') }} ({{ dashboards.length }})
            </div>
            <div class="space-y-1.5">
              <div
                v-for="dashboard in dashboards"
                :key="dashboard.id"
                class="flex items-center gap-2 text-sm text-nc-content-gray-subtle hover:text-nc-content-gray-emphasis transition-colors cursor-pointer"
              >
                <NcIconDashboard :dashboard="dashboard" class="w-4 h-4 flex-none" />
                <span class="truncate">{{ dashboard.title }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
