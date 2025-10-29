<script lang="ts" setup>
import { OnDeleteActionMeta, SyncTriggerMeta, SyncTypeMeta, TARGET_TABLES_META } from 'nocodb-sdk'

const { syncConfigForm } = useSyncStoreOrThrow()

// Get the display labels for the selected options
const syncTypeLabel = computed(() => {
  const type = syncConfigForm.value.sync_type
  return SyncTypeMeta[type]?.label || type
})

const syncTriggerLabel = computed(() => {
  const trigger = syncConfigForm.value.sync_trigger
  return SyncTriggerMeta[trigger]?.label || trigger
})

const onDeleteActionLabel = computed(() => {
  const action = syncConfigForm.value.on_delete_action
  return OnDeleteActionMeta[action]?.label || action
})

// Get filtered models based on sync category
const availableModels = computed(() => {
  return Object.values(TARGET_TABLES_META).filter(
    (model) => model.category === syncConfigForm.value.sync_category || !syncConfigForm.value.sync_category,
  )
})

// Check if we're syncing all models or specific ones
const syncAllModels = computed(() => {
  return syncConfigForm.value.exclude_models.length === 0
})

// Get selected models (models not in exclude_models)
const selectedModels = computed(() => {
  if (syncAllModels.value) {
    return availableModels.value
  }
  return availableModels.value.filter((model) => !syncConfigForm.value.exclude_models.includes(model.value))
})
</script>

<template>
  <div class="nc-review-container">
    <!-- Title Section -->
    <div class="nc-review-hero">
      <div class="flex items-center gap-3">
        <div class="nc-hero-icon">
          <GeneralIcon icon="ncZap" class="w-6 h-6 text-brand-600" />
        </div>
        <div>
          <div class="text-lg font-semibold text-gray-900">{{ syncConfigForm.title || 'Untitled Sync' }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Review your sync configuration before creating</div>
        </div>
      </div>
    </div>

    <!-- Configuration Grid -->
    <div class="nc-config-grid">
      <div class="nc-config-item">
        <div class="nc-config-header">
          <div class="nc-config-icon-wrapper">
            <GeneralIcon icon="refresh" class="w-4 h-4 text-brand-600" />
          </div>
          <div class="nc-config-label">Sync Type</div>
        </div>
        <div class="nc-config-value">{{ syncTypeLabel }}</div>
      </div>

      <div class="nc-config-item">
        <div class="nc-config-header">
          <div class="nc-config-icon-wrapper">
            <GeneralIcon icon="clock" class="w-4 h-4 text-brand-600" />
          </div>
          <div class="nc-config-label">Sync Trigger</div>
        </div>
        <div class="nc-config-value">{{ syncTriggerLabel }}</div>
      </div>

      <div class="nc-config-item">
        <div class="nc-config-header">
          <div class="nc-config-icon-wrapper">
            <GeneralIcon icon="delete" class="w-4 h-4 text-brand-600" />
          </div>
          <div class="nc-config-label">On Delete</div>
        </div>
        <div class="nc-config-value">{{ onDeleteActionLabel }}</div>
      </div>
    </div>

    <!-- Models Section -->
    <div v-if="syncConfigForm.sync_category !== 'custom'" class="nc-models-section">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="table" class="text-gray-600 w-4 h-4" />
          <span class="text-sm font-semibold text-gray-800">Models</span>
        </div>
        <div class="text-xs text-gray-500 font-medium">
          {{ syncAllModels ? 'All models' : `${selectedModels.length} selected` }}
        </div>
      </div>

      <div v-if="syncAllModels" class="nc-all-models-badge">
        <GeneralIcon icon="check" class="text-green-600 w-4 h-4" />
        <span>All available models will be synced</span>
      </div>

      <div v-else class="nc-models-grid">
        <div v-for="model in selectedModels" :key="model.value" class="nc-model-chip">
          <GeneralIcon :icon="model.icon" class="w-3.5 h-3.5 text-gray-600" />
          <span>{{ model.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-review-container {
  @apply w-full flex flex-col gap-6;
}

.nc-review-hero {
  @apply pb-6 border-b border-gray-200;
}

.nc-hero-icon {
  @apply w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center;
}

.nc-config-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-3;
}

.nc-config-item {
  @apply flex flex-col gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50;
  @apply hover:border-brand-200 hover:bg-white transition-all duration-200;
}

.nc-config-header {
  @apply flex items-center gap-2;
}

.nc-config-icon-wrapper {
  @apply w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center;
}

.nc-config-label {
  @apply text-xs font-semibold text-gray-600;
}

.nc-config-value {
  @apply text-base font-semibold text-gray-900;
}

.nc-models-section {
  @apply flex flex-col;
}

.nc-all-models-badge {
  @apply flex items-center gap-2 p-3 rounded-lg bg-green-50 text-sm font-medium text-green-700;
}

.nc-models-grid {
  @apply flex flex-wrap gap-2;
}

.nc-model-chip {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-full;
  @apply bg-gray-100 text-xs font-medium text-gray-700;
}
</style>
