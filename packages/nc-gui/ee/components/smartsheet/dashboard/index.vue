<script setup lang="ts">
const route = useRoute()

// Stores
const dashboardStore = useDashboardStore()
const widgetStore = useWidgetStore()

const { selectedWidget, widgets } = storeToRefs(widgetStore)
const { activeDashboard, isEditingDashboard } = storeToRefs(dashboardStore)

provide(IsDashboardInj, ref(true))

const isLoading = ref(true)

watchEffect(async () => {
  const dashboardId = route.params.dashboardId as string
  if (dashboardId && activeDashboard.value?.id === dashboardId) {
    // Only show loading state if the widgets are not already loaded
    // Else it would be a jarring ui, as the loading state would be shown for a split second
    if (!widgets.value.has(dashboardId)) {
      isLoading.value = true
    }
    await widgetStore.loadWidgets({ dashboardId })
    isLoading.value = false
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
    <div
      class="p-4 flex-1 h-full relative overflow-y-auto"
      :class="{
        'flex items-center justify-center': isLoading,
      }"
    >
      <general-overlay
        v-show="isLoading"
        :model-value="isLoading"
        inline
        transition
        class="!bg-opacity-15 rounded-xl overflow-hidden"
      >
        <div class="flex flex-col items-center justify-center h-full w-full !bg-white !bg-opacity-80">
          <a-spin size="large" />
        </div>
      </general-overlay>
      <SmartsheetDashboardGrid v-if="!isLoading" />
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
