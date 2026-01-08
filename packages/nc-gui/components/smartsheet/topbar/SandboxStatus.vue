<script setup lang="ts">
const { base } = storeToRefs(useBase())
const { $api } = useNuxtApp()

const isModalVisible = ref(false)
const initialTab = ref<'publish' | 'fork' | 'deployments' | undefined>(undefined)

const sandbox = ref<any>(null)
const currentVersion = ref<any>(null)

const isSandboxMaster = computed(() => !!(base.value as any)?.sandbox_master && !!(base.value as any)?.sandbox_id)

// Load sandbox info and current version
const loadSandbox = async () => {
  if (!(base.value as any)?.sandbox_id || !base.value?.fk_workspace_id) return

  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'sandboxGet',
      baseId: base.value.id,
    } as any)
    if (response) {
      sandbox.value = response
    }
  } catch (e) {
    console.error('Failed to load sandbox:', e)
  }
}

// Load current version info
const loadCurrentVersion = async () => {
  if (!base.value?.sandbox_version_id || !base.value?.fk_workspace_id) return

  try {
    // Get version details from versions list
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id!, {
      operation: 'sandboxVersionsList',
      sandboxId: (base.value as any).sandbox_id,
    } as any)
    if (response?.list) {
      currentVersion.value = response.list.find((v: any) => v.id === base.value.sandbox_version_id)
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
  await loadSandbox()
  await loadCurrentVersion()
}

const handleForked = async () => {
  await loadSandbox()
  await loadCurrentVersion()
}

watch(
  () => (base.value as any)?.sandbox_id,
  async (sandboxId) => {
    if (sandboxId) {
      await loadSandbox()
      await loadCurrentVersion()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="isSandboxMaster" class="flex items-center gap-2">
    <!-- Version Badge (clickable to open modal) -->
    <div
      class="flex items-center gap-1.5 px-2.5 py-1 bg-nc-bg-gray-light rounded-md border border-nc-border-gray-medium cursor-pointer hover:bg-nc-bg-gray-medium transition-colors"
      @click="openModal()"
    >
      <GeneralIcon icon="ncInfoSolid" class="w-3.5 h-3.5 text-nc-content-gray" />
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

  <!-- Sandbox Modal -->
  <SmartsheetTopbarSandboxModal
    v-model:visible="isModalVisible"
    :sandbox="sandbox"
    :current-version="currentVersion"
    :initial-tab="initialTab"
    @published="handlePublished"
    @forked="handleForked"
  />
</template>
