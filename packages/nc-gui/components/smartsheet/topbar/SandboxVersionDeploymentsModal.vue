<script setup lang="ts">
import { DeploymentStatus } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  sandbox: any
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
  if (!props.sandbox?.id || !props.version?.versionId || !base.value?.fk_workspace_id) return

  isLoading.value = true
  try {
    const offset = (page - 1) * pageSize
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'sandboxVersionDeployments',
      sandboxId: props.sandbox.id,
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
      operation: 'sandboxDeploymentLogs',
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
    <div class="flex flex-col h-full max-h-[80vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-nc-border-gray-medium">
        <div>
          <div class="font-semibold text-lg text-nc-content-gray-emphasis">Version Deployments</div>
          <div class="text-xs text-nc-content-gray-subtle2">
            Tracking deployments for
            <span class="font-mono font-semibold">v{{ version?.version }}</span>
          </div>
        </div>
        <GeneralIcon
          icon="close"
          class="w-5 h-5 text-nc-content-gray cursor-pointer hover:text-nc-content-gray-emphasis"
          @click="emit('update:visible', false)"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <a-spin size="large" />
        </div>

        <template v-else-if="deployments.length > 0">
          <div class="space-y-3">
            <div
              v-for="deployment in deployments"
              :key="deployment.baseId"
              class="bg-nc-bg-gray-light border border-nc-border-gray-light rounded-lg overflow-hidden"
            >
              <!-- Deployment Row -->
              <div class="p-4 cursor-pointer transition-colors" @click="toggleExpand(deployment)">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4 flex-1">
                    <!-- Expand Icon -->
                    <GeneralIcon
                      :icon="expandedBaseId === deployment.baseId ? 'ncChevronDown' : 'ncChevronRight'"
                      class="w-4 h-4 text-nc-content-gray-subtle2 transition-transform"
                    />

                    <!-- Deployment Info -->
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-white dark:bg-nc-bg-gray-light rounded-md">
                        <GeneralIcon icon="ncServer" class="w-4 h-4 text-nc-content-gray" />
                      </div>
                      <div>
                        <div class="font-medium text-sm text-nc-content-gray-emphasis">{{ deployment.baseTitle }}</div>
                        <div class="text-xs text-nc-content-gray-subtle2 mt-0.5">
                          Installed: {{ formatDate(deployment.installedAt) }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Status Badge -->
                  <div class="px-2.5 py-1 text-xs rounded-full font-semibold" :class="getStatusColor(deployment.status)">
                    {{ deployment.status }}
                  </div>
                </div>
              </div>

              <!-- Expanded Logs Section -->
              <div v-if="expandedBaseId === deployment.baseId" class="border-t border-nc-border-gray-medium">
                <div class="p-4 bg-nc-bg-gray-light">
                  <div class="text-xs font-semibold text-nc-content-gray-emphasis mb-3 uppercase tracking-wide">
                    Deployment History
                  </div>

                  <div v-if="isLoadingLogs" class="flex items-center justify-center py-8">
                    <a-spin />
                  </div>

                  <template v-else-if="deploymentLogs.length > 0">
                    <div class="space-y-2">
                      <div v-for="log in deploymentLogs" :key="log.id" class="bg-white dark:bg-nc-bg-gray-light rounded-md p-3">
                        <div class="flex items-start justify-between">
                          <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1.5">
                              <span class="px-2 py-0.5 text-xs rounded font-semibold" :class="getStatusColor(log.status)">
                                {{ log.status }}
                              </span>
                              <span class="text-xs font-medium text-nc-content-gray">
                                {{ getDeploymentTypeLabel(log.deploymentType) }}
                              </span>
                            </div>

                            <div class="flex items-center gap-3 text-xs text-nc-content-gray-subtle2">
                              <div v-if="log.fromVersion">
                                <span class="font-mono">v{{ log.fromVersion.version }}</span>
                                <GeneralIcon icon="arrowRight" class="inline-block w-3 h-3 mx-1" />
                              </div>
                              <span class="font-mono font-semibold">v{{ log.toVersion?.version }}</span>
                              <span class="text-nc-content-gray-subtle2">•</span>
                              <span>{{ formatDate(log.createdAt) }}</span>
                            </div>

                            <div v-if="log.errorMessage" class="mt-2 text-xs text-nc-content-red-dark">
                              {{ log.errorMessage }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Logs Pagination -->
                    <div v-if="logsPageInfo.totalRows > logsPageSize" class="flex justify-center mt-4">
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

                  <div v-else class="text-center py-8">
                    <div class="text-sm text-nc-content-gray-subtle2">No deployment history available</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Deployments Pagination -->
          <div v-if="pageInfo.totalRows > pageSize" class="flex justify-center mt-6">
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
        <div v-else class="text-center py-16">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-nc-bg-gray-light mb-4">
            <GeneralIcon icon="ncServer" class="w-8 h-8 text-nc-content-gray-subtle2" />
          </div>
          <div class="text-base font-medium text-nc-content-gray-emphasis mb-1">No deployments found</div>
          <div class="text-sm text-nc-content-gray-subtle2">No installations are using version {{ version?.version }}</div>
        </div>
      </div>
    </div>
  </GeneralModal>
</template>
