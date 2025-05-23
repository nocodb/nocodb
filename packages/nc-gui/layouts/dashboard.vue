<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

// Use tryUseRealtimeStore instead of direct access to handle initialization issues
const realtimeStore = ref(null)

// Try to get the realtime store, but handle the case where it might not be initialized yet
const tryUseRealtimeStore = () => {
  try {
    const store = useRealtimeStore()
    if (store) {
      realtimeStore.value = store
    }
    return store
  } catch (err) {
    console.warn('Realtime store not available yet:', err.message)
    return null
  }
}

// Initialize on mounted
onMounted(() => {
  tryUseRealtimeStore()
})

// Conditionally show sync overlay when there are errors or during initial sync
const showSyncOverlay = computed(() => {
  const store = realtimeStore.value || tryUseRealtimeStore()
  if (!store) return false

  return store.hasError || (store.isSyncing && store.stats.bootstrapCount === 0)
})
</script>

<script lang="ts">
export default {
  name: 'DashboardLayout',
}
</script>

<template>
  <NuxtLayout>
    <slot v-if="!route.meta.hasSidebar" name="content" />

    <LazyDashboardView v-else>
      <template #sidebar>
        <slot name="sidebar" />
      </template>

      <template #topbar-right>
        <!-- Realtime status indicator in the top bar -->
        <RealtimeStatus :show-always="false" />
      </template>

      <template #content>
        <slot name="content" />
      </template>
    </LazyDashboardView>

    <!-- Sync overlay for errors and initial sync -->
    <RealtimeSyncOverlay v-if="showSyncOverlay" />
  </NuxtLayout>
</template>
