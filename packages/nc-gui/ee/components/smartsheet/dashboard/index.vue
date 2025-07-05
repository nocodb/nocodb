<script setup lang="ts">
const { isMobileMode } = useGlobal()
const route = useRoute()

// Stores
const dashboardStore = useDashboardStore()
const widgetStore = useWidgetStore()

const { selectedWidget } = storeToRefs(widgetStore)
const { activeDashboard, isEditingDashboard } = storeToRefs(dashboardStore)

provide(IsDashboardInj, ref(true))

watchEffect(() => {
  const dashboardId = route.params.dashboardId as string
  if (dashboardId && activeDashboard.value?.id === dashboardId) {
    widgetStore.loadWidgets({ dashboardId })
  }
})
</script>

<template>
  <SmartsheetDashboardToolbar v-if="isEditingDashboard" />
  <div
    :class="{
      'main-content-editor': isEditingDashboard,
      'main-content': !isEditingDashboard,
    }"
    class="flex bg-nc-bg-gray-light flex-1"
  >
    <div class="p-4 flex-1 h-full overflow-y-auto">
      <SmartsheetDashboardGrid />
    </div>

    <SmartsheetDashboardWidgetEditor v-if="selectedWidget" :key="selectedWidget?.id" />
  </div>
</template>

<style scoped lang="scss">
.main-content-editor {
  height: calc(100vh - 2 * var(--topbar-height));
}

.main-content {
  height: calc(100vh - var(--topbar-height));
}
</style>
