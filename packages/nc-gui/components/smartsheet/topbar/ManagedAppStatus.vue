<script setup lang="ts">
const { base, isManagedAppMaster } = storeToRefs(useBase())
const { $api } = useNuxtApp()

const isModalVisible = ref(false)
const initialTab = ref<'publish' | 'fork' | 'deployments' | undefined>(undefined)

const managedApp = ref<any>(null)
const currentVersion = ref<any>(null)

// Load managed app info and current version
const loadManagedApp = async () => {
  if (!(base.value as any)?.managed_app_id || !base.value?.fk_workspace_id) return

  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'managedAppGet',
      baseId: base.value.id,
    } as any)
    if (response) {
      managedApp.value = response
    }
  } catch (e) {
    console.error('Failed to load managed app:', e)
  }
}

// Load current version info
const loadCurrentVersion = async () => {
  if (!base.value?.managed_app_version_id || !base.value?.fk_workspace_id) return

  try {
    // Get version details from versions list
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'managedAppVersionsList',
      managedAppId: (base.value as any).managed_app_id,
    } as any)
    if (response?.list) {
      currentVersion.value = response.list.find((v: any) => v.id === base.value.managed_app_version_id)
    }
  } catch (e) {
    console.error('Failed to load current version:', e)
  }
}

const openModal = (tab?: 'publish' | 'fork' | 'deployments') => {
  initialTab.value = tab
  isModalVisible.value = true
}

const handlePublished = async () => {
  await loadManagedApp()
  await loadCurrentVersion()
}

const handleForked = async () => {
  await loadManagedApp()
  await loadCurrentVersion()
}

watch(
  () => (base.value as any)?.managed_app_id,
  async (managedAppId) => {
    if (managedAppId) {
      await loadManagedApp()
      await loadCurrentVersion()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="isManagedAppMaster" class="flex items-center gap-2">
    <!-- Version Badge (clickable to open modal) -->
    <div
      class="flex items-center gap-1.5 px-2.5 py-1 bg-nc-bg-gray-light rounded-md border-1 border-nc-border-gray-medium cursor-pointer hover:(bg-nc-bg-gray-medium border-nc-border-gray-dark) transition-colors"
      @click="openModal()"
    >
      <GeneralIcon icon="ncInfoSolid" class="w-3.5 h-3.5 text-nc-content-gray nc-managed-app-status-info-icon" />
      <span class="text-xs font-mono font-semibold text-nc-content-gray-emphasis">v{{ currentVersion?.version || '1.0.0' }}</span>
      <div
        v-if="currentVersion?.status === 'draft'"
        class="ml-1 px-1.5 py-0.5 text-xs rounded bg-nc-bg-orange-light text-nc-content-orange-dark font-medium"
      >
        {{ $t('labels.draft') }}
      </div>
      <div
        v-else-if="currentVersion?.status === 'published'"
        class="ml-1 px-1.5 py-0.5 text-xs rounded bg-nc-bg-green-dark text-nc-content-green-dark font-medium"
      >
        {{ $t('labels.published') }}
      </div>
    </div>
  </div>

  <!-- Managed App Modal -->
  <SmartsheetTopbarManagedAppModal
    v-model:visible="isModalVisible"
    :managed-app="managedApp"
    :current-version="currentVersion"
    :initial-tab="initialTab"
    @published="handlePublished"
    @forked="handleForked"
  />
</template>

<style lang="scss" scoped>
:deep(.nc-managed-app-status-info-icon path.nc-icon-inner) {
  stroke: var(--nc-bg-gray-light) !important;
}
</style>
