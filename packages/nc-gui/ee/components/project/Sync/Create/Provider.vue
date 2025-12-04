<script setup lang="ts">
interface Props {
  baseId?: string
}

const props = defineProps<Props>()

const { $api } = useNuxtApp()

const { isUIAllowed, loadRoles } = useRoles()

const { bases, activeProjectId } = storeToRefs(useBases())

const syncStore = useSyncStore()

const { loadDynamicIntegrations, loadIntegrations, isLoadedIntegrations } = useIntegrationStore()

const { loadSyncs, triggerSync: _triggerSync, openNewSyncCreateModal } = syncStore

const { isSyncFeatureEnabled } = storeToRefs(syncStore)

const { blockSync } = useEeConfig()

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

const isSyncOptionVisible = computed(() => {
  return isSyncFeatureEnabled.value && isUIAllowed('tableCreate', { source: currentBase.value?.sources?.[0] })
})

watch(
  [isSyncOptionVisible, blockSync],
  async ([newVal, newBlockSync]) => {
    if (!newVal || newBlockSync) return

    const promises = [loadDynamicIntegrations()]

    if (!isLoadedIntegrations.value) {
      promises.push(loadIntegrations())
    }

    await Promise.all(promises)

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
  <slot
    v-if="isSyncOptionVisible"
    :is-sync-option-visible="isSyncOptionVisible"
    :create-sync-click="
      () => {
        openNewSyncCreateModal({ baseId: currentBase?.id })
      }
    "
  >
  </slot>
</template>
