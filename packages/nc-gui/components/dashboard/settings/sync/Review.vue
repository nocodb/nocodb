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
  <div class="review-container">
    <!-- Basic configuration -->
    <div class="section">
      <div class="section-title">
        <GeneralIcon icon="settings" class="text-primary mr-2" />
        <h3>Sync Configuration</h3>
      </div>
      <a-card class="mb-4 !rounded-lg">
        <div class="grid grid-cols-2 gap-4">
          <div class="info-item">
            <div class="info-label">Title</div>
            <div class="info-value">{{ syncConfigForm.title }}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Sync Type</div>
            <div class="info-value">
              <GeneralIcon icon="refresh" class="text-primary mr-2" />
              {{ syncTypeLabel }}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Sync Trigger</div>
            <div class="info-value">
              <GeneralIcon icon="clock" class="text-primary mr-2" />
              {{ syncTriggerLabel }}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">On Delete Action</div>
            <div class="info-value">
              <GeneralIcon icon="delete" class="text-primary mr-2" />
              {{ onDeleteActionLabel }}
            </div>
          </div>
        </div>
      </a-card>
    </div>

    <!-- Models to sync -->
    <div class="section">
      <div class="section-title">
        <GeneralIcon icon="table" class="text-primary mr-2" />
        <h3>Models to Sync</h3>
        <div class="text-xs text-gray-500 ml-auto">
          {{
            syncAllModels ? 'All models will be synced' : `${selectedModels.length} of ${availableModels.length} models selected`
          }}
        </div>
      </div>
      <a-card class="mb-4 !rounded-lg">
        <div class="model-list">
          <div v-if="syncAllModels" class="flex items-center py-2">
            <GeneralIcon icon="check" class="text-green-600 mr-2" />
            <span class="text-sm">All available models will be synced</span>
          </div>
          <div v-else class="grid grid-cols-2 gap-2">
            <div v-for="model in selectedModels" :key="model.value" class="model-item">
              <GeneralIcon :icon="model.icon" class="text-primary mr-2" />
              <span>{{ model.label }}</span>
            </div>
          </div>
        </div>
      </a-card>
    </div>

    <!-- Integrations 
    <div class="section">
      <div class="section-title">
        <GeneralIcon icon="link" class="text-primary mr-2" />
        <h3>Integration</h3>
      </div>
      <div class="flex flex-col gap-2">
        <a-card v-for="(integration, i) in integrationConfigs" :key="`${integration.sub_type}-${i}`" class="!rounded-lg">
          <div v-if="integration.sub_type" class="flex items-center">
            <div class="rounded-full p-3 mr-4">
              <GeneralIntegrationIcon :type="integration.sub_type" />
            </div>
            <div>
              <div class="text-base font-medium">{{ integration.sub_type }}</div>
              <div class="text-gray-500 text-sm">Connected and ready to sync</div>
            </div>
          </div>
          <div v-else class="text-gray-500 text-sm flex items-center">
            <GeneralIcon icon="warning" class="text-amber-500 mr-2" />
            No integration configured
          </div>
        </a-card>
      </div>
    </div>
    -->
  </div>
</template>

<style lang="scss" scoped>
.review-container {
  @apply w-full;
}

.section {
  @apply mb-6;
}

.section-title {
  @apply flex items-center mb-3;

  h3 {
    @apply text-base font-medium m-0 text-gray-700;
  }
}

.info-item {
  @apply mb-2;
}

.info-label {
  @apply text-xs text-gray-500 mb-1;
}

.info-value {
  @apply text-sm font-medium flex items-center;
}

.model-item {
  @apply flex items-center py-1 px-2 text-sm bg-gray-50 rounded-md;
}

:deep(.ant-card) {
  @apply border border-gray-200 shadow-sm;
}

:deep(.ant-card-body) {
  @apply p-4;
}
</style>
