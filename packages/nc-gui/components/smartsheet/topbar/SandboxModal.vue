<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  sandbox: any
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
  if (!props.sandbox?.id || !base.value?.fk_workspace_id) return

  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'sandboxVersionsList',
      sandboxId: props.sandbox.id,
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
  if (!props.sandbox?.id || !base.value?.fk_workspace_id) return

  isLoadingDeployments.value = true
  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'sandboxDeployments',
      sandboxId: props.sandbox.id,
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
        operation: 'sandboxPublish',
      },
      {
        sandboxVersionId: props.currentVersion.id,
      },
    )

    // Reload base to get updated sandbox version info
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
  if (!base.value?.fk_workspace_id || !base.value?.id || !props.sandbox?.id) return
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
        operation: 'sandboxCreateDraft',
      },
      {
        sandboxId: props.sandbox.id,
        version: forkForm.version,
      },
    )

    // Reload base to get updated sandbox version info
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
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const suggestNextVersion = () => {
  if (!props.currentVersion?.version) {
    forkForm.version = '1.0.0'
    return
  }

  const currentVersion = props.currentVersion.version
  const versionParts = currentVersion.split('.')
  if (versionParts.length === 3) {
    // Increment minor version for new draft
    versionParts[1] = String(Number(versionParts[1]) + 1)
    versionParts[2] = '0'
    forkForm.version = versionParts.join('.')
  } else {
    forkForm.version = ''
  }
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
      if (!isDraft.value && !props.initialTab) {
        suggestNextVersion()
      }
    }
  },
)
</script>

<template>
  <GeneralModal :visible="visible" size="large" centered @update:visible="emit('update:visible', $event)">
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-nc-border-gray-medium">
        <div>
          <div class="font-semibold text-lg text-nc-content-gray-emphasis">Sandbox Management</div>
          <div class="text-xs text-nc-content-gray-subtle2">Manage versions and track deployments</div>
        </div>
        <GeneralIcon
          icon="close"
          class="w-5 h-5 text-nc-content-gray cursor-pointer hover:text-nc-content-gray-emphasis"
          @click="emit('update:visible', false)"
        />
      </div>

      <!-- Tabs -->
      <div class="flex gap-6 px-6 pt-3 border-b border-nc-border-gray-medium">
        <button
          v-if="isDraft"
          class="pb-2 px-1 text-sm font-medium transition-colors border-b-2"
          :class="[
            activeTab === 'publish'
              ? 'border-nc-content-brand text-nc-content-brand'
              : 'border-transparent text-nc-content-gray hover:text-nc-content-gray-emphasis',
          ]"
          @click="activeTab = 'publish'"
        >
          Publish
        </button>
        <button
          v-if="isPublished"
          class="pb-2 px-1 text-sm font-medium transition-colors border-b-2"
          :class="[
            activeTab === 'fork'
              ? 'border-nc-content-brand text-nc-content-brand'
              : 'border-transparent text-nc-content-gray hover:text-nc-content-gray-emphasis',
          ]"
          @click="activeTab = 'fork'"
        >
          Fork
        </button>
        <button
          class="pb-2 px-1 text-sm font-medium transition-colors border-b-2"
          :class="[
            activeTab === 'deployments'
              ? 'border-nc-content-brand text-nc-content-brand'
              : 'border-transparent text-nc-content-gray hover:text-nc-content-gray-emphasis',
          ]"
          @click="activeTab = 'deployments'"
        >
          Deployments
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Publish Tab -->
        <div v-if="activeTab === 'publish'" class="p-6">
          <div class="mb-4 bg-nc-bg-blue-light border border-nc-border-blue rounded-lg p-4">
            <div class="flex gap-3">
              <GeneralIcon icon="info" class="w-5 h-5 text-nc-content-blue-dark mt-0.5 flex-shrink-0" />
              <div class="text-sm text-nc-content-gray">
                Publishing version <strong>{{ currentVersion?.version }}</strong> will make it available in the App Store and
                automatically update all installations.
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">Version</label>
              <a-input :value="currentVersion?.version" disabled size="large" class="rounded-lg">
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
                class="rounded-lg"
              />
            </div>
          </div>
        </div>

        <!-- Fork Tab -->
        <div v-if="activeTab === 'fork'" class="p-6">
          <div class="mb-4 bg-nc-bg-blue-light border border-nc-border-blue rounded-lg p-4">
            <div class="flex gap-3">
              <GeneralIcon icon="info" class="w-5 h-5 text-nc-content-blue-dark mt-0.5 flex-shrink-0" />
              <div class="text-sm text-nc-content-gray">
                Create a new draft version to work on updates. Current published version
                <strong>{{ currentVersion?.version }}</strong> will remain unchanged.
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">
                New Version <span class="text-nc-content-red-dark">*</span>
              </label>
              <a-input v-model:value="forkForm.version" placeholder="e.g., 2.0.0" size="large" class="rounded-lg">
                <template #prefix>
                  <span class="text-nc-content-gray-subtle2">v</span>
                </template>
              </a-input>
              <div class="text-xs text-nc-content-gray-subtle2 mt-1.5">Use semantic versioning (e.g., 2.0.0, 2.1.0)</div>
            </div>
          </div>
        </div>

        <!-- Deployments Tab -->
        <div v-if="activeTab === 'deployments'" class="p-6">
          <div v-if="isLoadingDeployments" class="flex items-center justify-center py-12">
            <a-spin size="large" />
          </div>

          <template v-else-if="deploymentStats">
            <!-- Stats Cards -->
            <div class="grid grid-cols-4 gap-4 mb-8">
              <!-- Total Deployments -->
              <div class="bg-nc-bg-gray-light rounded-lg p-4 border border-nc-border-gray-light">
                <div class="flex items-center justify-between mb-3">
                  <div class="p-2 bg-nc-bg-blue-light rounded-lg">
                    <GeneralIcon icon="ncServer" class="w-5 h-5 text-nc-content-blue-dark" />
                  </div>
                </div>
                <div class="text-3xl font-bold text-nc-content-gray-emphasis mb-1">
                  {{ deploymentStats.statistics?.totalDeployments || 0 }}
                </div>
                <div class="text-xs font-medium text-nc-content-gray-subtle2 uppercase tracking-wide">Total Deployments</div>
              </div>

              <!-- Active -->
              <div class="bg-nc-bg-gray-light rounded-lg p-4 border border-nc-border-gray-light">
                <div class="flex items-center justify-between mb-3">
                  <div class="p-2 bg-nc-bg-green-light rounded-lg">
                    <GeneralIcon icon="check" class="w-5 h-5 text-nc-content-green-dark" />
                  </div>
                </div>
                <div class="text-3xl font-bold text-nc-content-gray-emphasis mb-1">
                  {{ deploymentStats.statistics?.activeDeployments || 0 }}
                </div>
                <div class="text-xs font-medium text-nc-content-gray-subtle2 uppercase tracking-wide">Active</div>
              </div>

              <!-- Failed -->
              <div class="bg-nc-bg-gray-light rounded-lg p-4 border border-nc-border-gray-light">
                <div class="flex items-center justify-between mb-3">
                  <div class="p-2 bg-nc-bg-red-light rounded-lg">
                    <GeneralIcon icon="alertTriangle" class="w-5 h-5 text-nc-content-red-dark" />
                  </div>
                </div>
                <div class="text-3xl font-bold text-nc-content-gray-emphasis mb-1">
                  {{ deploymentStats.statistics?.failedDeployments || 0 }}
                </div>
                <div class="text-xs font-medium text-nc-content-gray-subtle2 uppercase tracking-wide">Failed</div>
              </div>

              <!-- Versions -->
              <div class="bg-nc-bg-gray-light rounded-lg p-4 border border-nc-border-gray-light">
                <div class="flex items-center justify-between mb-3">
                  <div class="p-2 bg-nc-bg-purple-light rounded-lg">
                    <GeneralIcon icon="ncGitBranch" class="w-5 h-5 text-nc-content-purple-dark" />
                  </div>
                </div>
                <div class="text-3xl font-bold text-nc-content-gray-emphasis mb-1">
                  {{ deploymentStats.statistics?.totalVersions || 0 }}
                </div>
                <div class="text-xs font-medium text-nc-content-gray-subtle2 uppercase tracking-wide">Versions</div>
              </div>
            </div>

            <!-- Version List Header -->
            <div v-if="deploymentStats.versionStats && deploymentStats.versionStats.length > 0" class="mb-4">
              <h3 class="text-sm font-semibold text-nc-content-gray-emphasis">Version History</h3>
              <p class="text-xs text-nc-content-gray-subtle2 mt-1">Track deployments across all published versions</p>
            </div>

            <!-- Version List with Real Stats -->
            <div v-if="deploymentStats.versionStats && deploymentStats.versionStats.length > 0" class="space-y-2">
              <div
                v-for="(versionStat, index) in deploymentStats.versionStats"
                :key="versionStat.versionId"
                class="bg-nc-bg-gray-light border border-nc-border-gray-light rounded-lg p-4 hover:border-nc-border-brand hover:shadow-sm transition-all duration-200"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4 flex-1">
                    <!-- Version Badge -->
                    <div class="flex items-center gap-2">
                      <div class="p-2 bg-white dark:bg-nc-bg-gray-medium rounded-md">
                        <GeneralIcon icon="ncGitBranch" class="w-4 h-4 text-nc-content-gray" />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-mono font-bold text-base text-nc-content-gray-emphasis"
                            >v{{ versionStat.version }}</span
                          >
                          <div
                            v-if="index === 0 && versionStat.status === 'published'"
                            class="px-2 py-0.5 text-xs rounded-full bg-nc-bg-green-light text-nc-content-green-dark font-semibold"
                          >
                            Current
                          </div>
                        </div>
                        <div class="text-xs text-nc-content-gray-subtle2 mt-0.5">
                          {{ formatDate(versionStat.publishedAt) }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Deployment Count -->
                  <template v-if="versionStat.deploymentCount === 0">
                    <div
                      class="flex items-center gap-3 px-4 py-2 bg-white dark:bg-nc-bg-gray-medium rounded-lg border border-nc-border-gray-light transition-all"
                    >
                      <GeneralIcon icon="ncServer" class="w-4 h-4 text-nc-content-gray-subtle2" />
                      <div class="text-right">
                        <div class="text-lg font-bold text-nc-content-gray-emphasis">{{ versionStat.deploymentCount }}</div>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <a-tooltip placement="top" title="Click to view deployments">
                      <div
                        class="flex items-center gap-3 px-4 py-2 bg-white dark:bg-nc-bg-gray-medium rounded-lg border border-nc-border-gray-light cursor-pointer hover:border-nc-border-brand hover:shadow-sm transition-all"
                        @click="openVersionDeploymentsModal(versionStat)"
                      >
                        <GeneralIcon icon="ncServer" class="w-4 h-4 text-nc-content-gray-subtle2" />
                        <div class="text-right">
                          <div class="text-lg font-bold text-nc-content-gray-emphasis">{{ versionStat.deploymentCount }}</div>
                        </div>
                      </div>
                    </a-tooltip>
                  </template>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-16">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-nc-bg-gray-light mb-4">
                <GeneralIcon icon="ncServer" class="w-8 h-8 text-nc-content-gray-subtle2" />
              </div>
              <div class="text-base font-medium text-nc-content-gray-emphasis mb-1">No deployments yet</div>
              <div class="text-sm text-nc-content-gray-subtle2">Users will appear here once they install your application</div>
            </div>
          </template>

          <div v-else class="text-center py-16">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-nc-bg-red-light mb-4">
              <GeneralIcon icon="alertTriangle" class="w-8 h-8 text-nc-content-red-dark" />
            </div>
            <div class="text-base font-medium text-nc-content-gray-emphasis mb-1">Failed to load statistics</div>
            <div class="text-sm text-nc-content-gray-subtle2">Please try refreshing the page</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="activeTab === 'publish' || activeTab === 'fork'" class="px-6 py-4 border-t border-nc-border-gray-medium">
        <div class="flex justify-end gap-2">
          <NcButton type="secondary" size="medium" @click="emit('update:visible', false)"> Cancel </NcButton>

          <NcButton v-if="activeTab === 'publish'" type="primary" size="medium" :loading="isLoading" @click="publishCurrentDraft">
            <template #icon>
              <GeneralIcon icon="upload" />
            </template>
            Publish Version
          </NcButton>

          <NcButton
            v-if="activeTab === 'fork'"
            type="primary"
            size="medium"
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
    <SmartsheetTopbarSandboxVersionDeploymentsModal
      v-model:visible="showVersionDeploymentsModal"
      :sandbox="sandbox"
      :version="selectedVersion"
    />
  </GeneralModal>
</template>
