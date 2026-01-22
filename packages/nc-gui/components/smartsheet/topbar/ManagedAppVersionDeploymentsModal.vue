<script setup lang="ts">
import { DeploymentStatus } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  managedApp: any
  version: any
}>()

const emit = defineEmits(['update:visible'])

const { $api } = useNuxtApp()
const { base } = storeToRefs(useBase())

const isLoading = ref(false)
const deployments = ref<any[]>([])
const pageInfo = ref<any>({})
const currentPage = ref(1)
const pageSize = 10

// Expanded deployment logs state
const expandedBaseId = ref<string | null>(null)
const deploymentLogs = ref<any[]>([])
const logsPageInfo = ref<any>({})
const logsCurrentPage = ref(1)
const logsPageSize = 10
const isLoadingLogs = ref(false)

const loadDeployments = async (page = 1) => {
  if (!props.managedApp?.id || !props.version?.versionId || !base.value?.fk_workspace_id) return

  isLoading.value = true
  try {
    const offset = (page - 1) * pageSize
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'managedAppVersionDeployments',
      managedAppId: props.managedApp.id,
      versionId: props.version.versionId,
      limit: pageSize,
      offset,
    } as any)

    if (response) {
      deployments.value = response.list || []
      pageInfo.value = response.pageInfo || {}
      currentPage.value = page
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const loadDeploymentLogs = async (baseId: string, page = 1) => {
  if (!base.value?.fk_workspace_id) return

  isLoadingLogs.value = true
  try {
    const offset = (page - 1) * logsPageSize
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'managedAppDeploymentLogs',
      baseId,
      limit: logsPageSize,
      offset,
    } as any)

    if (response) {
      deploymentLogs.value = response.logs || []
      logsPageInfo.value = response.pageInfo || {}
      logsCurrentPage.value = page
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoadingLogs.value = false
  }
}

const toggleExpand = async (deployment: any) => {
  if (expandedBaseId.value === deployment.baseId) {
    // Collapse
    expandedBaseId.value = null
    deploymentLogs.value = []
    logsCurrentPage.value = 1
  } else {
    // Expand and load logs
    expandedBaseId.value = deployment.baseId
    await loadDeploymentLogs(deployment.baseId, 1)
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getDeploymentTypeLabel = (type: string) => {
  const labels = {
    install: 'Initial Install',
    update: 'Update',
  }
  return labels[type as keyof typeof labels] || type
}

const getStatusColor = (status: string) => {
  const colors = {
    [DeploymentStatus.SUCCESS]: 'text-nc-content-green-dark bg-nc-bg-green-light',
    [DeploymentStatus.FAILED]: 'text-nc-content-red-dark bg-nc-bg-red-light',
    [DeploymentStatus.PENDING]: 'text-nc-content-orange-dark bg-nc-bg-orange-light',
    [DeploymentStatus.IN_PROGRESS]: 'text-nc-content-blue-dark bg-nc-bg-blue-light',
  }
  return colors[status as keyof typeof colors] || 'text-nc-content-gray bg-nc-bg-gray-light'
}

const handlePageChange = (page: number) => {
  loadDeployments(page)
}

const handleLogsPageChange = (page: number) => {
  if (expandedBaseId.value) {
    loadDeploymentLogs(expandedBaseId.value, page)
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      loadDeployments(1)
      expandedBaseId.value = null
      deploymentLogs.value = []
    }
  },
)
</script>

<template>
  <GeneralModal :visible="visible" size="large" centered @update:visible="emit('update:visible', $event)">
    <div class="nc-deployments-modal">
      <!-- Header -->
      <div class="nc-deployments-header">
        <div class="nc-deployments-header-icon">
          <GeneralIcon icon="ncServer" class="w-5 h-5 text-white" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-semibold text-nc-content-gray-emphasis m-0">Version Deployments</h2>
          <p class="text-xs text-nc-content-gray-subtle2 m-0 mt-0.5">
            Tracking installations for
            <span class="font-mono font-semibold text-nc-content-brand">v{{ version?.version }}</span>
          </p>
        </div>
        <NcButton type="text" size="small" class="!px-1" @click="emit('update:visible', false)">
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </div>

      <!-- Content -->
      <div class="nc-deployments-content">
        <div v-if="isLoading" class="nc-deployments-loading">
          <a-spin size="large" />
          <div class="text-sm text-nc-content-gray-muted mt-3">Loading deployments...</div>
        </div>

        <template v-else-if="deployments.length > 0">
          <div class="nc-deployments-list">
            <div v-for="deployment in deployments" :key="deployment.baseId" class="nc-deployment-item">
              <!-- Deployment Row -->
              <div class="nc-deployment-row" @click="toggleExpand(deployment)">
                <div class="nc-deployment-info">
                  <!-- Expand Icon -->
                  <div class="nc-expand-icon">
                    <GeneralIcon
                      :icon="expandedBaseId === deployment.baseId ? 'ncChevronDown' : 'ncChevronRight'"
                      class="w-4 h-4"
                    />
                  </div>

                  <!-- Deployment Details -->
                  <div class="nc-deployment-icon">
                    <GeneralIcon icon="ncServer" class="w-4 h-4" />
                  </div>
                  <div class="nc-deployment-details">
                    <div class="nc-deployment-title">{{ deployment.baseTitle }}</div>
                    <div class="nc-deployment-date">
                      <GeneralIcon icon="calendar" class="w-3.5 h-3.5 opacity-60" />
                      <span>Installed {{ formatDate(deployment.installedAt) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Status Badge -->
                <div class="nc-deployment-status">
                  <div class="nc-status-badge" :class="getStatusColor(deployment.status)">
                    <span>{{ deployment.status }}</span>
                  </div>
                </div>
              </div>

              <!-- Expanded Logs Section -->
              <div v-if="expandedBaseId === deployment.baseId" class="nc-deployment-logs-wrapper">
                <div class="nc-deployment-logs">
                  <div class="nc-logs-header">
                    <GeneralIcon icon="ncFileText" class="w-4 h-4 text-nc-content-gray-subtle2" />
                    <span>Deployment History</span>
                  </div>

                  <div v-if="isLoadingLogs" class="nc-logs-loading">
                    <a-spin size="small" />
                    <span class="text-xs text-nc-content-gray-muted ml-2">Loading history...</span>
                  </div>

                  <template v-else-if="deploymentLogs.length > 0">
                    <div class="nc-logs-list">
                      <div v-for="log in deploymentLogs" :key="log.id" class="nc-log-item">
                        <div class="nc-log-content">
                          <div class="nc-log-header">
                            <div class="nc-log-badges">
                              <div class="nc-log-status" :class="getStatusColor(log.status)">
                                {{ log.status }}
                              </div>
                              <div class="nc-log-type">
                                <GeneralIcon
                                  :icon="log.deploymentType === 'install' ? 'download' : 'reload'"
                                  class="w-3 h-3 opacity-60"
                                />
                                <span>{{ getDeploymentTypeLabel(log.deploymentType) }}</span>
                              </div>
                            </div>
                          </div>

                          <div class="nc-log-meta">
                            <div class="nc-log-version">
                              <div v-if="log.fromVersion" class="flex items-center gap-1.5">
                                <span class="font-mono text-nc-content-gray-subtle2">v{{ log.fromVersion.version }}</span>
                                <GeneralIcon icon="arrowRight" class="w-3 h-3 text-nc-content-gray-subtle2" />
                              </div>
                              <span class="font-mono font-semibold text-nc-content-brand">v{{ log.toVersion?.version }}</span>
                            </div>
                            <span class="nc-log-divider">•</span>
                            <div class="nc-log-time">
                              <GeneralIcon icon="clock" class="w-3.5 h-3.5 opacity-60" />
                              <span>{{ formatDate(log.createdAt) }}</span>
                            </div>
                          </div>

                          <div v-if="log.errorMessage" class="nc-log-error">
                            <GeneralIcon icon="alertTriangle" class="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{{ log.errorMessage }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Logs Pagination -->
                    <div v-if="logsPageInfo.totalRows > logsPageSize" class="nc-logs-pagination">
                      <a-pagination
                        v-model:current="logsCurrentPage"
                        :total="logsPageInfo.totalRows"
                        :page-size="logsPageSize"
                        :show-size-changer="false"
                        size="small"
                        @change="handleLogsPageChange"
                      />
                    </div>
                  </template>

                  <div v-else class="nc-logs-empty">
                    <GeneralIcon icon="inbox" class="w-8 h-8 text-nc-content-gray-subtle2 mb-2" />
                    <div class="text-sm text-nc-content-gray-subtle2">No deployment history available</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Deployments Pagination -->
          <div v-if="pageInfo.totalRows > pageSize" class="nc-deployments-pagination">
            <a-pagination
              v-model:current="currentPage"
              :total="pageInfo.totalRows"
              :page-size="pageSize"
              :show-size-changer="false"
              @change="handlePageChange"
            />
          </div>
        </template>

        <!-- Empty State -->
        <div v-else class="nc-deployments-empty">
          <div class="nc-empty-icon">
            <GeneralIcon icon="ncServer" class="w-10 h-10 text-nc-content-gray-muted" />
          </div>
          <div class="text-base font-semibold text-nc-content-gray mb-1">No installations found</div>
          <div class="text-sm text-nc-content-gray-subtle max-w-md text-center">
            Version <span class="font-mono font-semibold">v{{ version?.version }}</span> hasn't been installed by any users yet
          </div>
        </div>
      </div>
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
.nc-deployments-modal {
  @apply flex flex-col h-full max-h-[80vh];
}

.nc-deployments-header {
  @apply flex items-center gap-3 px-4 py-3 border-b-1 border-nc-border-gray-medium;
}

.nc-deployments-header-icon {
  @apply w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0;
  background: linear-gradient(135deg, var(--nc-content-brand) 0%, var(--nc-content-blue-medium) 100%);
  box-shadow: 0 2px 4px rgba(51, 102, 255, 0.15);
}

.nc-deployments-content {
  @apply flex-1 overflow-y-auto p-6;
}

.nc-deployments-loading {
  @apply flex flex-col items-center justify-center py-16;
}

.nc-deployments-list {
  @apply space-y-3;
}

.nc-deployment-item {
  @apply bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl overflow-hidden relative;
  @apply transition-all duration-200 ease-in-out;

  &::before {
    @apply absolute left-0 top-0 bottom-0 w-1 bg-nc-content-brand opacity-0;
    @apply transition-opacity duration-200 ease-in-out;
    content: '';
  }

  &:hover {
    @apply border-nc-border-brand transform translate-x-0.5;
    box-shadow: 0 4px 12px rgba(51, 102, 255, 0.08);

    &::before {
      @apply opacity-100;
    }

    .nc-deployment-icon {
      @apply transform scale-105;
      box-shadow: 0 4px 8px rgba(51, 102, 255, 0.15);
    }
  }
}

.nc-deployment-row {
  @apply flex items-center justify-between gap-4 p-4 cursor-pointer;
}

.nc-deployment-info {
  @apply flex items-center gap-3 flex-1 min-w-0;
}

.nc-expand-icon {
  @apply w-6 h-6 flex items-center justify-center text-nc-content-gray-subtle2 flex-shrink-0;
  @apply transition-transform duration-200;
}

.nc-deployment-icon {
  @apply w-9 h-9 rounded-lg bg-nc-bg-gray-light border-1 border-nc-border-gray-light;
  @apply flex items-center justify-center text-nc-content-gray flex-shrink-0;
  @apply transition-all duration-200 ease-in-out;
}

.nc-deployment-details {
  @apply flex-1 min-w-0;
}

.nc-deployment-title {
  @apply font-semibold text-sm text-nc-content-gray-emphasis truncate mb-1;
}

.nc-deployment-date {
  @apply flex items-center gap-1.5 text-xs text-nc-content-gray-subtle2;
}

.nc-deployment-status {
  @apply flex-shrink-0;
}

.nc-status-badge {
  @apply inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold;
}

.nc-deployment-logs-wrapper {
  @apply border-t-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight;
}

.nc-deployment-logs {
  @apply p-4;
}

.nc-logs-header {
  @apply flex items-center gap-2 text-xs font-semibold text-nc-content-gray-emphasis mb-3;
  @apply uppercase tracking-wide;
}

.nc-logs-loading {
  @apply flex items-center justify-center py-8;
}

.nc-logs-list {
  @apply space-y-2;
}

.nc-log-item {
  @apply bg-nc-bg-default border-1 border-nc-border-gray-light rounded-lg p-3;
  @apply transition-all duration-150;

  &:hover {
    @apply border-nc-border-gray-medium shadow-sm;
  }
}

.nc-log-content {
  @apply space-y-2;
}

.nc-log-header {
  @apply flex items-center justify-between gap-2;
}

.nc-log-badges {
  @apply flex items-center gap-2 flex-wrap;
}

.nc-log-status {
  @apply inline-flex px-2 py-0.5 rounded text-xs font-semibold;
}

.nc-log-type {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded;
  @apply bg-nc-bg-gray-light text-nc-content-gray text-xs font-medium;
}

.nc-log-meta {
  @apply flex items-center gap-2 text-xs text-nc-content-gray-subtle2 flex-wrap;
}

.nc-log-version {
  @apply flex items-center gap-1.5;
}

.nc-log-divider {
  @apply text-nc-content-gray-subtle2;
}

.nc-log-time {
  @apply flex items-center gap-1;
}

.nc-log-error {
  @apply flex items-start gap-2 p-2 rounded-lg;
  @apply bg-nc-bg-red-light text-nc-content-red-dark text-xs;
}

.nc-logs-pagination {
  @apply flex justify-center mt-4 pt-4 border-t-1 border-nc-border-gray-light;
}

.nc-logs-empty {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.nc-deployments-pagination {
  @apply flex justify-center mt-6;
}

.nc-deployments-empty {
  @apply flex flex-col items-center justify-center py-16;
}

.nc-empty-icon {
  @apply w-16 h-16 rounded-full bg-nc-bg-gray-light;
  @apply flex items-center justify-center mb-4;
}

// Responsive
@media (max-width: 640px) {
  .nc-deployment-row {
    @apply flex-col items-start;
  }

  .nc-deployment-info {
    @apply w-full;
  }

  .nc-deployment-status {
    @apply w-full;
  }

  .nc-log-meta {
    @apply flex-col items-start gap-1;
  }
}
</style>
