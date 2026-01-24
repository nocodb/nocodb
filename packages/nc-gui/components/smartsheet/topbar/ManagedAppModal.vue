<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  managedApp: any
  currentVersion: any
  initialTab?: 'publish' | 'fork' | 'deployments'
}>()

const emit = defineEmits(['update:visible', 'published', 'forked'])

const { $api } = useNuxtApp()
const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const activeTab = ref('publish')
const isLoading = ref(false)
const isLoadingDeployments = ref(false)
const versions = ref<any[]>([])
const deploymentStats = ref<any>(null)

// Version deployments modal
const showVersionDeploymentsModal = ref(false)
const selectedVersion = ref<any>(null)

// Publish form (for draft versions)
const publishForm = reactive({
  releaseNotes: '',
})

// Fork form (for creating new draft from published)
const forkForm = reactive({
  version: '',
  releaseNotes: '',
})

const isPublished = computed(() => props.currentVersion?.status === 'published')
const isDraft = computed(() => props.currentVersion?.status === 'draft')

// Load versions
const loadVersions = async () => {
  if (!props.managedApp?.id || !base.value?.fk_workspace_id) return

  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'managedAppVersionsList',
      managedAppId: props.managedApp.id,
    } as any)
    if (response?.list) {
      versions.value = response.list
    }
  } catch (e: any) {
    console.error('Failed to load versions:', e)
  }
}

// Load real deployment statistics
const loadDeployments = async () => {
  if (!props.managedApp?.id || !base.value?.fk_workspace_id) return

  isLoadingDeployments.value = true
  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'managedAppDeployments',
      managedAppId: props.managedApp.id,
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

const publishCurrentDraft = async () => {
  if (!base.value?.fk_workspace_id || !base.value?.id || !props.currentVersion?.id) return

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      base.value.id,
      {
        operation: 'managedAppPublish',
      },
      {
        managedAppVersionId: props.currentVersion.id,
      },
    )

    // Reload base to get updated managed app version info
    if (base.value?.id) {
      await baseStore.loadProject()
    }

    message.success(`Version ${props.currentVersion.version} published successfully!`)
    emit('published')
    emit('update:visible', false)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const createNewDraft = async () => {
  if (!base.value?.fk_workspace_id || !base.value?.id || !props.managedApp?.id) return
  if (!forkForm.version) {
    message.error('Please provide a version')
    return
  }

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      base.value.id,
      {
        operation: 'managedAppCreateDraft',
      },
      {
        managedAppId: props.managedApp.id,
        version: forkForm.version,
      },
    )

    // Reload base to get updated managed app version info
    if (base.value?.id) {
      await baseStore.loadProject()
    }

    message.success(`New draft version ${forkForm.version} created successfully!`)
    emit('forked')
    emit('update:visible', false)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'

  return parseStringDateTime(dateString, 'MMM DD, YYYY, HH:mm A')
}

const openVersionDeploymentsModal = (version: any) => {
  selectedVersion.value = version
  showVersionDeploymentsModal.value = true
}

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      // Use initialTab if provided, otherwise default based on version status
      if (props.initialTab) {
        activeTab.value = props.initialTab
      } else if (isDraft.value) {
        activeTab.value = 'publish'
      } else if (isPublished.value) {
        activeTab.value = 'fork'
      } else {
        // Fallback to deployments if version status is unclear
        activeTab.value = 'deployments'
      }

      await loadVersions()
      await loadDeployments()
      if (!isDraft.value) {
        forkForm.version = suggestManagedAppNextVersion(props.currentVersion?.version)
      }
    }
  },
)

const modalSize = computed(() => {
  if (props.initialTab === 'fork' || props.initialTab === 'publish') {
    return 'sm'
  }

  return 'sm'
})
</script>

<template>
  <NcModal
    :visible="visible"
    :size="modalSize"
    :height="modalSize === 'sm' ? 'auto' : undefined"
    nc-modal-class-name="nc-modal-managed-app-management"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="flex flex-col h-full">
      <!-- Header with Tabs -->
      <div class="nc-managed-app-header">
        <div class="flex items-center gap-3 flex-1">
          <div class="nc-managed-app-icon">
            <GeneralIcon icon="ncBox" class="h-5 w-5 text-white" />
          </div>
          <div class="flex-1">
            <div class="text-lg font-semibold text-nc-content-gray-emphasis">Managed App Management</div>
            <div class="text-xs text-nc-content-gray-subtle2">Manage versions and track deployments</div>
          </div>
        </div>

        <!-- Tabs (Segmented Control) -->
        <div class="nc-managed-app-tabs">
          <div class="flex items-center">
            <div
              v-if="isDraft"
              class="nc-managed-app-tab"
              :class="{ selected: activeTab === 'publish' }"
              @click="activeTab = 'publish'"
            >
              <GeneralIcon icon="upload" class="h-4 w-4 flex-none opacity-75" />
              <span>Publish</span>
            </div>
            <div
              v-if="isPublished"
              class="nc-managed-app-tab"
              :class="{ selected: activeTab === 'fork' }"
              @click="activeTab = 'fork'"
            >
              <GeneralIcon icon="ncGitBranch" class="h-4 w-4 flex-none opacity-75" />
              <span>Fork</span>
            </div>
            <div class="nc-managed-app-tab" :class="{ selected: activeTab === 'deployments' }" @click="activeTab = 'deployments'">
              <GeneralIcon icon="ncServer" class="h-4 w-4 flex-none opacity-75" />
              <span>Deployments</span>
            </div>
          </div>
        </div>

        <NcButton size="small" type="text" @click="emit('update:visible', false)">
          <GeneralIcon icon="close" class="text-nc-content-gray-muted h-4 w-4" />
        </NcButton>
      </div>

      <!-- Content -->
      <div class="flex-1 nc-scrollbar-thin">
        <!-- Publish Tab -->
        <div v-if="activeTab === 'publish'" class="p-6">
          <NcAlert
            type="info"
            align="top"
            class="!p-3 !items-start bg-nc-bg-blue-light border-1 !border-nc-blue-200 rounded-lg p-3 mb-4"
          >
            <template #icon>
              <GeneralIcon icon="info" class="w-4 h-4 mt-0.5 text-nc-content-blue-dark flex-none" />
            </template>

            <template #description>
              Publishing version <strong>{{ currentVersion?.version }}</strong> will make it available in the App Store and
              automatically update all installations.
            </template>
          </NcAlert>

          <div class="space-y-4">
            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">Version</label>
              <a-input :value="currentVersion?.version" disabled size="large" class="rounded-lg nc-input-sm">
                <template #prefix>
                  <span class="text-nc-content-gray-subtle2">v</span>
                </template>
              </a-input>
            </div>

            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">Release Notes (Optional)</label>
              <a-textarea
                v-model:value="publishForm.releaseNotes"
                placeholder="Describe what's new in this version"
                :rows="6"
                size="large"
                class="rounded-lg nc-input-sm"
              />
            </div>
          </div>
        </div>

        <!-- Fork Tab -->
        <div v-if="activeTab === 'fork'" class="p-6">
          <NcAlert
            type="info"
            align="top"
            class="!p-3 !items-start bg-nc-bg-blue-light border-1 !border-nc-blue-200 rounded-lg p-3 mb-4"
          >
            <template #icon>
              <GeneralIcon icon="info" class="w-4 h-4 mt-0.5 text-nc-content-blue-dark flex-none" />
            </template>

            <template #description>
              Create a new draft version to work on updates. Current published version
              <strong>{{ currentVersion?.version }}</strong> will remain unchanged.
            </template>
          </NcAlert>

          <div class="space-y-4">
            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">
                New Version <span class="text-nc-content-red-dark">*</span>
              </label>
              <a-input
                v-model:value="forkForm.version"
                placeholder="e.g., 2.0.0"
                size="large"
                class="rounded-lg nc-input-sm nc-input-shadow"
              >
                <template #prefix>
                  <span class="text-nc-content-gray-subtle2">v</span>
                </template>
              </a-input>
              <div class="text-xs text-nc-content-gray-subtle2 mt-1.5">Use semantic versioning (e.g., 2.0.0, 2.1.0)</div>
            </div>
          </div>
        </div>

        <!-- Deployments Tab -->
        <div v-if="activeTab === 'deployments'" class="nc-deployments-content">
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
                  <h3 class="text-sm font-semibold text-nc-content-gray-emphasis">Version History</h3>
                  <p class="text-xs text-nc-content-gray-subtle2 mt-0.5">
                    {{ deploymentStats.versionStats.length }}
                    {{ deploymentStats.versionStats.length === 1 ? 'version' : 'versions' }}
                    published
                  </p>
                </div>
              </div>

              <div class="nc-version-list">
                <div
                  v-for="(versionStat, index) in deploymentStats.versionStats"
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
                        <div v-if="index === 0 && versionStat.status === 'published'" class="nc-version-badge">
                          <GeneralIcon icon="check" class="w-3 h-3" />
                          <span>Current</span>
                        </div>
                      </div>
                      <div class="nc-version-date">Published {{ formatDate(versionStat.publishedAt) }}</div>
                    </div>
                  </div>

                  <div class="nc-version-installs">
                    <div class="nc-installs-count">
                      <GeneralIcon icon="download" class="w-4 h-4 text-nc-content-gray-subtle2" />
                      <span class="font-bold">{{ versionStat.deploymentCount }}</span>
                      <span class="text-nc-content-gray-muted">{{
                        versionStat.deploymentCount === 1 ? 'install' : 'installs'
                      }}</span>
                    </div>
                    <GeneralIcon
                      v-if="versionStat.deploymentCount > 0"
                      icon="chevronRight"
                      class="w-4 h-4 text-nc-content-gray-subtle2 nc-chevron-icon"
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

      <!-- Footer -->
      <div v-if="activeTab === 'publish' || activeTab === 'fork'" class="nc-managed-app-footer">
        <div class="flex justify-end gap-2">
          <NcButton type="secondary" size="small" @click="emit('update:visible', false)"> Cancel </NcButton>

          <NcButton v-if="activeTab === 'publish'" type="primary" size="small" :loading="isLoading" @click="publishCurrentDraft">
            <template #icon>
              <GeneralIcon icon="upload" />
            </template>
            Publish
          </NcButton>

          <NcButton
            v-if="activeTab === 'fork'"
            type="primary"
            size="small"
            :loading="isLoading"
            :disabled="!forkForm.version"
            @click="createNewDraft"
          >
            <template #icon>
              <GeneralIcon icon="plus" />
            </template>
            Create Draft
          </NcButton>
        </div>
      </div>
    </div>

    <!-- Version Deployments Modal -->
    <SmartsheetTopbarManagedAppVersionDeploymentsModal
      v-model:visible="showVersionDeploymentsModal"
      :managed-app="managedApp"
      :version="selectedVersion"
    />
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-managed-app-header {
  @apply flex items-center gap-4 px-4 py-3 border-b-1 border-nc-border-gray-medium;
}

.nc-managed-app-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center;
  background: linear-gradient(135deg, var(--nc-content-brand) 0%, var(--nc-content-blue-medium) 100%);
  box-shadow: 0 2px 4px rgba(51, 102, 255, 0.15);
}

.nc-managed-app-tabs {
  @apply flex bg-nc-bg-gray-medium rounded-lg p-1;
}

.nc-managed-app-tab {
  @apply px-3 py-1.5 flex items-center gap-2 text-xs rounded-md select-none cursor-pointer;
  @apply text-nc-content-gray-subtle2 transition-all duration-200;

  &.selected {
    @apply bg-nc-bg-default text-nc-content-gray-emphasis;
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }

  &:hover:not(.selected) {
    @apply text-nc-content-gray;
  }
}

.nc-managed-app-footer {
  @apply px-6 py-3 border-t-1 border-nc-border-gray-medium;
}

// Deployments Tab Styles
.nc-deployments-content {
  @apply px-6 pb-6;
}

.nc-deployments-loading {
  @apply flex flex-col items-center justify-center py-16;
}

.nc-deployment-stats {
  @apply grid grid-cols-4 mb-6;
}

.nc-stat-card {
  @apply flex flex-col gap-1 items-center justify-center border-r-1 border-nc-border-gray-medium last:border-r-0 p-4 text-nc-content-gray-subtle;
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
  @apply mt-6;
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
  @apply font-mono font-bold text-base text-nc-content-gray-emphasis;
}

.nc-version-badge {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full;
  @apply bg-nc-bg-green-light text-nc-content-green-dark;
  @apply text-xs font-semibold;
}

.nc-version-date {
  @apply text-xs text-nc-content-gray-subtle2;
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

// Responsive
@media (max-width: 1024px) {
  .nc-deployment-stats {
    @apply grid-cols-2 gap-3;
  }
}

@media (max-width: 640px) {
  .nc-deployment-stats {
    @apply grid-cols-1;
  }

  .nc-version-item {
    @apply flex-col items-start;
  }

  .nc-version-installs {
    @apply w-full justify-between;
  }
}
</style>

<style lang="scss">
.nc-modal-managed-app-management {
  @apply !p-0;

  &.nc-modal-size-sm {
    max-height: min(90vh, 540px) !important;
    height: min(90vh, 540px) !important;
  }
}
</style>
