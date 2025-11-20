<script setup lang="ts">
interface Props {
  baseId?: string
}

const props = defineProps<Props>()

const { $api } = useNuxtApp()

const { isUIAllowed, loadRoles } = useRoles()

const { bases, activeProjectId } = storeToRefs(useBases())

const syncStore = useSyncStore()

const { loadDynamicIntegrations, loadIntegrations } = useIntegrationStore()

const { loadSyncs, triggerSync: _triggerSync } = syncStore

const { isSyncFeatureEnabled } = storeToRefs(syncStore)

const { blockSync, showUpgradeToUseSync } = useEeConfig()

const isCreateSyncModalOpen = ref(false)

const showProgressModal = ref(false)

const syncJobId = ref<string | null>(null)

const isSyncOptionVisible = computed(() => {
  return isSyncFeatureEnabled.value && isUIAllowed('tableCreate', { source: currentBase.value?.sources?.[0] })
})

const currentBase = computedAsync(async () => {
  let base

  if (props.baseId) {
    base = bases.value.get(props.baseId)

    if (!base) {
      base = await $api.base.read(props.baseId!)
    }
  } else {
    base = bases.value.get(activeProjectId.value)
  }

  return base
})

const onCreateSyncClick = () => {
  if (showUpgradeToUseSync()) return

  isCreateSyncModalOpen.value = true
}

watch(
  [isSyncOptionVisible, blockSync],
  async ([newVal, newBlockSync]) => {
    if (!newVal || newBlockSync) return

    await Promise.all([loadDynamicIntegrations(), loadIntegrations()])

    await waitForValueExists(
      () => currentBase.value?.id,
      (id) => !!id,
    )
    if (!currentBase.value?.id) return
    await loadSyncs(currentBase.value?.id)
  },
  {
    immediate: true,
  },
)

onMounted(async () => {
  if (props.baseId) {
    await loadRoles(props.baseId)
  }
})
</script>

<template>
  <ProjectActionItem
    v-if="isSyncOptionVisible"
    v-e="['c:table:create-sync']"
    data-testid="proj-view-btn__create-sync"
    :label="$t('labels.syncData')"
    :subtext="$t('msg.subText.syncData')"
    @click="onCreateSyncClick"
  >
    <template #icon>
      <GeneralIcon icon="ncZap" class="!h-7 !w-7 !text-nc-content-green-dark" />
    </template>

    <template #srOnly>
      <ProjectSyncCreate
        v-if="isCreateSyncModalOpen"
        v-model:value="isCreateSyncModalOpen"
        :base-id="currentBase?.id!"
        @sync-created="
          (jobId) => {
            syncJobId = jobId
            showProgressModal = true
          }
        "
      />

      <ProjectSyncProgressModal v-if="syncJobId" v-model="showProgressModal" :job-id="syncJobId" :base-id="currentBase?.id!" />
    </template>
  </ProjectActionItem>
</template>
