<script setup lang="ts">
definePageMeta({
  public: true,
  requiresAuth: false,
  layout: 'shared-view',
  hasSidebar: false,
})

const route = useRoute()

const { triggerNotFound } = useSharedView()

const showPassword = ref(false)

const dashboardStore = useDashboardStore()

const { activeDashboard } = storeToRefs(dashboardStore)

const { loadSharedDashboard } = dashboardStore

try {
  await loadSharedDashboard(route.params.dashboardId as string, '')
} catch (e: any) {
  if (e?.response?.status === 403) {
    showPassword.value = true
  } else if (e?.response?.status === 404) {
    triggerNotFound()
  } else {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

provide(IsPublicInj, ref(true))
</script>

<template>
  <div v-if="showPassword">
    <LazySmartsheetDashboardAskPassword v-model="showPassword" />
  </div>
  <SmartsheetDashboardGrid v-if="activeDashboard" />
</template>
