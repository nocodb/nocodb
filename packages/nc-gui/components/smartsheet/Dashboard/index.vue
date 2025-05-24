<script setup lang="ts">
const { isMobileMode } = useGlobal()
const route = useRoute()
const router = useRouter()

// Stores
const dashboardStore = useDashboardStore()
const widgetStore = useWidgetStore()
const { activeDashboard, isLoadingDashboard } = storeToRefs(dashboardStore)
const { activeDashboardWidgets, isLoading: isLoadingWidgets } = storeToRefs(widgetStore)

provide(IsDashboardInj, ref(true))

// State
const isEditMode = ref(false)
const showAddWidgetModal = ref(false)

watchEffect(() => {
  const dashboardId = route.params.dashboardId as string
  if (dashboardId && activeDashboard.value?.id === dashboardId) {
    widgetStore.loadWidgets({ dashboardId })
  }
})

const onAddWidget = () => {
  showAddWidgetModal.value = true
}

// Handle layout changes
const onLayoutChanged = (layout: any[]) => {
  // Layout changes are handled by the GridLayout component
  console.log('Layout changed:', layout)
}

// Toggle edit mode
const toggleEditMode = () => {
  isEditMode.value = !isEditMode.value
}

// Handle widget creation
const onWidgetCreated = () => {
  showAddWidgetModal.value = false
  // Refresh widgets
  const dashboardId = route.params.dashboardId as string
  if (dashboardId) {
    widgetStore.loadWidgets({ dashboardId, force: true })
  }
}

// Readonly mode based on permissions
const isReadonly = computed(() => {
  // TODO: Implement based on actual permissions
  return false
})
</script>

<template>
  <div class="nc-dashboard-container" :class="{ 'mobile-mode': isMobileMode }">
    <!-- Header -->

    <div class="dashboard-actions">
      <!-- Edit Mode Toggle -->
      <NcTooltip v-if="!isReadonly">
        <template #title>{{ isEditMode ? 'Exit Edit Mode' : 'Edit Dashboard' }}</template>
        <NcButton size="small" :type="isEditMode ? 'primary' : 'text'" @click="toggleEditMode">
          <template #icon>
            <MaterialSymbolsEdit class="w-4 h-4" />
          </template>
          {{ isEditMode ? 'Done' : 'Edit' }}
        </NcButton>
      </NcTooltip>

      <!-- Add Widget Button -->
      <NcTooltip v-if="isEditMode">
        <template #title>Add Widget</template>
        <NcButton size="small" type="primary" @click="onAddWidget">
          <template #icon>
            <MaterialSymbolsAdd class="w-4 h-4" />
          </template>
          Add Widget
        </NcButton>
      </NcTooltip>
    </div>

    <!-- Dashboard Content -->
    <div class="dashboard-content">
      <!-- Loading State -->
      <div v-if="isLoadingDashboard" class="loading-container">
        <div class="flex flex-col items-center justify-center h-full">
          <a-spin size="large" />
          <p class="text-gray-500 text-sm mt-4">Loading dashboard...</p>
        </div>
      </div>

      <!-- Dashboard Not Found -->
      <div v-else-if="!activeDashboard" class="error-container">
        <div class="flex flex-col items-center justify-center h-full text-center">
          <h3 class="text-xl font-semibold text-gray-700 mb-2">Dashboard Not Found</h3>
          <p class="text-gray-500 mb-4">The dashboard you're looking for doesn't exist or has been deleted.</p>
          <NcButton type="primary" @click="router.push('/')">Go Back</NcButton>
        </div>
      </div>

      <!-- Dashboard Grid -->
      <div v-else class="dashboard-grid">
        <!-- Dashboard Header -->
        <div v-if="activeDashboard.title || activeDashboard.description" class="dashboard-header">
          <h1 class="dashboard-title">{{ activeDashboard.title }}</h1>
          <p v-if="activeDashboard.description" class="dashboard-description">
            {{ activeDashboard.description }}
          </p>
        </div>

        <!-- Grid Layout -->
        <SmartsheetDashboardGridLayout
          :widgets="activeDashboardWidgets"
          :is-loading="isLoadingWidgets"
          :is-readonly="isReadonly || !isEditMode"
          @add-widget="onAddWidget"
          @layout-changed="onLayoutChanged"
        />
      </div>
    </div>

    <!-- Add Widget Modal -->
    <SmartsheetDashboardAddWidgetModal
      v-model:visible="showAddWidgetModal"
      :dashboard="activeDashboard"
      @created="onWidgetCreated"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-dashboard-container {
  @apply w-full h-full flex flex-col bg-gray-50;
  height: calc(100svh);
}

.dashboard-actions {
  @apply flex items-center gap-2;
}

.dashboard-content {
  @apply flex-1 overflow-hidden;
}

.loading-container,
.error-container {
  @apply w-full h-full flex items-center justify-center;
}

.dashboard-grid {
  @apply w-full h-full flex flex-col;
}

.dashboard-header {
  @apply px-6 py-4 bg-white border-b border-gray-200;
}

.dashboard-title {
  @apply text-2xl font-semibold text-gray-900 mb-1;
}

.dashboard-description {
  @apply text-gray-600 text-sm;
}

// Mobile adjustments
.mobile-mode {
  .dashboard-header {
    @apply px-4 py-3;
  }

  .dashboard-title {
    @apply text-xl;
  }

  .dashboard-actions {
    @apply gap-1;
  }
}
</style>
