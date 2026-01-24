<script lang="ts" setup>
interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const { $api } = useNuxtApp()

const baseStore = useBase()

const { base, managedApp, managedAppVersionsInfo } = storeToRefs(baseStore)

const isLoadingDeployments = ref(true)

const deploymentStats = ref<any>(null)

// Version deployments modal
const showVersionDeploymentsModal = ref(false)
const selectedVersion = ref<any>(null)

// Load real deployment statistics
const loadDeployments = async () => {
  if (!managedApp.value?.id || !base.value?.fk_workspace_id) return

  isLoadingDeployments.value = true
  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'managedAppDeployments',
      managedAppId: managedApp.value.id,
    } as any)
    if (response) {
      deploymentStats.value = response
    }
  } catch (e: any) {
    console.error('Failed to load deployments:', e)
  } finally {
    isLoadingDeployments.value = false
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'

  return parseStringDateTime(dateString, 'MMM DD, YYYY, hh:mm A')
}

const openVersionDeploymentsModal = (version: any) => {
  selectedVersion.value = version
  showVersionDeploymentsModal.value = true
}

watch(
  vVisible,
  (val) => {
    if (val) {
      loadDeployments()
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col h-full">
    <DlgManagedAppHeader v-model:visible="vVisible" title="Version History" sub-title="Manage versions and track deployments" />

    <div class="flex-1 nc-scrollbar-thin">
      <div
        class="nc-deployments-content"
        :class="{
          'h-full': isLoadingDeployments,
        }"
      >
        <div v-if="isLoadingDeployments" class="nc-deployments-loading">
          <a-spin size="large" />
          <div class="text-sm text-nc-content-gray-muted mt-3">Loading deployment statistics...</div>
        </div>

        <template v-else-if="deploymentStats">
          <!-- Stats Cards -->
          <div class="nc-deployment-stats">
            <!-- Total Deployments -->
            <div class="nc-stat-card">
              <div class="nc-stat-value">{{ deploymentStats.statistics?.totalDeployments || 0 }}</div>
              <div class="nc-stat-label">Total Installs</div>
            </div>

            <!-- Active -->
            <div class="nc-stat-card">
              <div class="nc-stat-value text-green-600">{{ deploymentStats.statistics?.activeDeployments || 0 }}</div>
              <div class="nc-stat-label">Active</div>
            </div>

            <!-- Failed -->
            <div class="nc-stat-card">
              <div class="nc-stat-value text-red-600">{{ deploymentStats.statistics?.failedDeployments || 0 }}</div>
              <div class="nc-stat-label">Failed</div>
            </div>

            <!-- Versions -->
            <div class="nc-stat-card">
              <div class="nc-stat-value">{{ deploymentStats.statistics?.totalVersions || 0 }}</div>
              <div class="nc-stat-label">Versions</div>
            </div>
          </div>

          <!-- Version List -->
          <div v-if="deploymentStats.versionStats && deploymentStats.versionStats.length > 0" class="nc-version-list-wrapper">
            <div class="nc-version-list-header">
              <div>
                <h3 class="text-sm font-semibold text-nc-content-gray">Version History</h3>

                <p class="text-xs text-nc-content-gray-subtle2 mt-0.5 mb-0">
                  {{ deploymentStats.versionStats.length }}
                  {{ deploymentStats.versionStats.length === 1 ? 'version' : 'versions' }}
                  published
                </p>
              </div>
            </div>

            <div class="nc-version-list">
              <div
                v-for="versionStat in deploymentStats.versionStats"
                :key="versionStat.versionId"
                class="nc-version-item"
                :class="{ 'nc-version-item-clickable': versionStat.deploymentCount > 0 }"
                @click="versionStat.deploymentCount > 0 && openVersionDeploymentsModal(versionStat)"
              >
                <div class="nc-version-info">
                  <div class="nc-version-icon">
                    <GeneralIcon icon="ncGitBranch" class="w-4 h-4" />
                  </div>
                  <div class="nc-version-details">
                    <div class="nc-version-title">
                      <span class="nc-version-number">v{{ versionStat.version }}</span>
                      <div v-if="managedAppVersionsInfo.published?.id === versionStat.versionId" class="nc-version-badge">
                        {{ $t('labels.live') }}
                      </div>
                      <div
                        v-else-if="managedAppVersionsInfo.current?.id === versionStat.versionId && versionStat.status === 'draft'"
                        class="nc-version-badge nc-version-badge-draft"
                      >
                        {{ $t('labels.draft') }}
                      </div>
                    </div>
                    <div class="nc-version-date">
                      <GeneralIcon icon="calendar" class="w-3.5 h-3.5 opacity-60" />

                      <span>Published {{ formatDate(versionStat.publishedAt) }}</span>
                    </div>
                  </div>
                </div>

                <div class="nc-version-installs">
                  <div class="nc-installs-count">
                    <GeneralIcon icon="download" class="w-4 h-4 text-nc-content-gray-subtle2" />
                    <span class="font-bold">{{ versionStat.deploymentCount }}</span>
                  </div>
                  <GeneralIcon
                    v-if="versionStat.deploymentCount > 0"
                    icon="chevronRight"
                    class="w-4 h-4 text-nc-content-gray-subtle2"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="nc-deployments-empty">
            <div class="nc-empty-icon">
              <GeneralIcon icon="ncServer" class="w-10 h-10 text-nc-content-gray-muted" />
            </div>
            <div class="text-base font-semibold text-nc-content-gray mb-1">No installations yet</div>
            <div class="text-sm text-nc-content-gray-subtle max-w-md text-center">
              Once users install your application from the App Store, their deployments will appear here.
            </div>
          </div>
        </template>

        <div v-else class="nc-deployments-error">
          <div class="nc-error-icon">
            <GeneralIcon icon="alertTriangle" class="w-10 h-10 text-nc-content-red-dark" />
          </div>
          <div class="text-base font-semibold text-nc-content-gray mb-1">Failed to load statistics</div>
          <div class="text-sm text-nc-content-gray-subtle mb-4">There was an error loading deployment data</div>
          <NcButton size="small" type="secondary" @click="loadDeployments">
            <template #icon>
              <GeneralIcon icon="reload" />
            </template>
            Retry
          </NcButton>
        </div>
      </div>
    </div>

    <DlgManagedApp v-model:visible="showVersionDeploymentsModal" modal-size="sm">
      <DlgManagedAppVersionDeployments v-model:visible="showVersionDeploymentsModal" :version="selectedVersion" />
    </DlgManagedApp>
  </div>
</template>

<style lang="scss" scoped>
// Deployments Tab Styles
.nc-deployments-content {
  @apply px-6 pb-6;
}

.nc-deployments-loading {
  @apply h-full flex flex-col items-center justify-center py-16;
}

.nc-deployment-stats {
  @apply grid grid-cols-4 mb-4;
}

.nc-stat-card {
  @apply flex flex-col gap-1 border-r-1 border-nc-border-gray-medium last:border-r-0 p-4 text-nc-content-gray-subtle text-center;
}

.nc-stat-icon-wrapper {
  @apply w-10 h-10 rounded-lg flex items-center justify-center mb-3;
}

.nc-stat-value {
  @apply text-subHeading1 font-normal;
}

.nc-stat-label {
  @apply text-tiny text-nc-content-gray-muted uppercase;
}

.nc-version-list-wrapper {
  @apply mt-4;
}

.nc-version-list-header {
  @apply flex items-center justify-between mb-4;
}

.nc-version-list {
  @apply space-y-2;
}

.nc-version-item {
  @apply bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl p-4 flex items-center justify-between gap-4 relative overflow-hidden;
  @apply transition-all duration-200 ease-in-out;

  &::before {
    @apply absolute left-0 top-0 bottom-0 w-1 bg-nc-content-brand opacity-0;
    @apply transition-opacity duration-200 ease-in-out;
    content: '';
  }

  &.nc-version-item-clickable {
    @apply cursor-pointer;

    &:hover {
      @apply border-nc-border-brand transform translate-x-0.5;
      box-shadow: 0 4px 12px rgba(51, 102, 255, 0.08);

      &::before {
        @apply opacity-100;
      }

      .nc-version-icon {
        @apply transform scale-105;
        box-shadow: 0 4px 8px rgba(51, 102, 255, 0.15);
      }

      .nc-chevron-icon {
        @apply opacity-100;
      }
    }
  }

  &:last-child {
    @apply mb-0;
  }
}

.nc-chevron-icon {
  @apply opacity-0 transition-opacity duration-200 ease-in-out;
}

.nc-version-info {
  @apply flex items-center gap-3 flex-1 min-w-0;
}

.nc-version-icon {
  @apply w-9 h-9 rounded-lg bg-nc-bg-gray-light border-1 border-nc-border-gray-light;
  @apply flex items-center justify-center text-nc-content-gray flex-shrink-0;
  @apply transition-all duration-200 ease-in-out;
}

.nc-version-details {
  @apply flex-1 min-w-0;
}

.nc-version-title {
  @apply flex items-center gap-2 mb-1;
}

.nc-version-number {
  @apply font-mono font-bold text-base text-nc-content-gray;
}

.nc-version-badge {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold;

  &.nc-version-badge-draft {
    @apply bg-nc-orange-20 dark:bg-nc-orange-20 text-orange-600;
  }

  &:not(.nc-version-badge-draft) {
    @apply bg-nc-green-50 dark:bg-nc-green-20 text-green-600;
  }
}

.nc-version-date {
  @apply text-xs text-nc-content-gray-subtle2 flex items-center gap-1.5;
}

.nc-version-installs {
  @apply flex items-center gap-3;
}

.nc-installs-count {
  @apply flex items-center gap-2 text-sm;
  @apply px-3 py-1.5 rounded-lg bg-nc-bg-gray-light;
}

.nc-deployments-empty {
  @apply flex flex-col items-center justify-center py-16;
}

.nc-empty-icon {
  @apply w-16 h-16 rounded-full bg-nc-bg-gray-light;
  @apply flex items-center justify-center mb-4;
}

.nc-deployments-error {
  @apply flex flex-col items-center justify-center py-16;
}

.nc-error-icon {
  @apply w-16 h-16 rounded-full bg-nc-bg-red-light;
  @apply flex items-center justify-center mb-4;
}
</style>
